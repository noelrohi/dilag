# Dilag

> AI-powered mobile UI design studio. Describe your app in natural language and watch AI generate stunning mobile interfaces in real-time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-24c8db?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6?logo=typescript)](https://www.typescriptlang.org)

![Dilag - AI Mobile UI Design Studio](assets/screenshot.png)

## Overview

Dilag is a desktop application that transforms design ideas into interactive HTML mockups. Simply describe what you want to build—"a meditation app dashboard," "an e-commerce checkout flow"—and AI generates beautiful, responsive mobile UI designs instantly. Iterate in real-time by chatting with the AI to refine and improve your designs.

Perfect for:
- 🎨 Rapid prototyping and design exploration
- 💡 Turning ideas into visual mockups without design tools
- 🔄 Iterating on designs through conversation
- 📱 Mobile-first UI generation
- 🚀 Accelerating the design-to-development workflow

## Features

✨ **Natural Language Design Generation** – Describe your mobile app and get instant HTML mockups

🎯 **Interactive Design Canvas** – Pan, zoom, drag-and-drop your designs with smooth interactions

💬 **Iterative Refinement** – Chat with AI to iterate and perfect your designs in real-time

🤖 **Multi-Model Support** – Choose from Claude, GPT, Gemini, and more

📚 **Design History** – Save, organize, and revisit all your design projects

🖼️ **Live Preview** – See designs rendered in iPhone 14 frames with pixel-perfect preview

## Quick Start

### Prerequisites

- **Node.js** 18+ and **Bun**
- **Rust** 1.70+ (for Tauri)
- **VS Code** (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dilag.git
cd dilag

# Install dependencies
bun install

# Start the development server
bun run tauri dev
```

### Development Commands

```bash
# Vite dev server (frontend only)
bun run dev

# Full Tauri app (frontend + Rust backend)
bun run tauri dev

# Type checking
tsc --noEmit

# Production build
bun run tauri build
```

## Architecture

### Frontend Stack
- **React 18** – UI framework
- **TypeScript** – Type safety
- **Vite** – Build tool
- **Tailwind CSS** – Styling
- **shadcn/ui** – Component library (Radix UI based)
- **Zustand** – Client state management
- **React Query** – Server state management
- **TanStack Router** – File-based routing

### Backend Stack
- **Tauri** – Desktop runtime (Rust)
- **OpenCode SDK** – AI integration with SSE streaming

### Data Flow
```
User Prompt
    ↓
Session Creation
    ↓
AI Processing (OpenCode)
    ↓
HTML Generation
    ↓
Live Preview on Canvas
    ↓
Iterative Refinement via Chat
```

## Project Structure

```
dilag/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ai-elements/         # Chat and AI UI components
│   │   ├── blocks/              # Page layouts and sections
│   │   └── ui/                  # shadcn/ui primitives
│   ├── context/
│   │   ├── global-events.tsx    # SSE event provider
│   │   └── session-store.tsx    # Zustand store
│   ├── hooks/
│   │   ├── use-designs.ts       # Design file polling
│   │   ├── use-models.ts        # Model selection
│   │   └── use-sessions.ts      # Session management
│   ├── routes/
│   │   ├── index.lazy.tsx       # Home screen
│   │   └── studio.$sessionId.lazy.tsx # Design studio
│   └── lib/
│       ├── tool-registry.tsx    # Tool display configs
│       └── utils.ts             # Utilities
├── src-tauri/                    # Rust backend (Tauri)
│   ├── src/
│   │   ├── lib.rs              # Commands
│   │   └── main.rs             # Entry point
│   └── tauri.conf.json          # Tauri config
├── docs/
│   ├── architecture.md          # Technical architecture
│   └── platform.md              # UI and platform docs
└── package.json
```

## Usage

### Creating Your First Design

1. **Launch the app** and land on the home screen
2. **Describe your design** in the prompt box:
   ```
   A meditation app with a homepage showing daily habits,
   a timer screen, and user profile
   ```
3. **Select your AI model** (Claude, GPT, etc.)
4. **Hit submit** and watch designs generate in real-time
5. **Refine** by chatting with the AI to iterate

### Managing Designs

- **Pan & Zoom** – Scroll to pan, Ctrl/Cmd+scroll to zoom (25%-200%)
- **Arrange Screens** – Drag screens on the canvas to reposition
- **Iterate** – Type in the chat pane to refine designs
- **Save Sessions** – All designs are automatically saved locally

## Data Storage

Dilag stores everything locally on your machine:

```
~/.dilag/
├── sessions/                    # Design project directories
│   └── {project-uuid}/
│       └── screens/            # Generated HTML files
├── sessions.json               # Project metadata
└── opencode/
    └── opencode.json          # AI agent config
```

Sensitive data (API keys, tokens) is stored in `~/.local/share/opencode/` and isolated from your designs.

## Development

### Code Style Guide

```typescript
// Imports: Use @/* alias for src/*
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Components: Function components with TypeScript
export function MyComponent({ prop }: { prop: string }) {
  return <div className={cn("base", "class")} />
}

// Naming conventions
// - Components: PascalCase (MyComponent.tsx)
// - Functions: camelCase (myFunction)
// - Files: kebab-case (my-component.tsx)
// - CSS: Tailwind with cn() utility
```

### Type Checking

```bash
tsc --noEmit
```

### Adding New Features

1. Check `docs/architecture.md` for current data flow
2. Update Zustand store if adding new state
3. Create components in appropriate `src/components/*` folder
4. Use `@/*` imports and TypeScript types
5. Test type checking: `tsc --noEmit`

## Documentation

- **[Platform Docs](./docs/platform.md)** – UI screens, components, user flows, tool registry
- **[Architecture Docs](./docs/architecture.md)** – App startup, storage, SSE events, session lifecycle
- **[AGENTS.md](./AGENTS.md)** – Development setup and conventions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Export designs to React components
- [ ] Figma integration
- [ ] Design template library
- [ ] Team collaboration features
- [ ] Mobile app companion
- [ ] Advanced design constraints

## Troubleshooting

### Server won't start

```bash
# Ensure no other instance is running on port 4096
lsof -i :4096

# Clear cached data
rm -rf ~/.dilag/opencode
bun run tauri dev
```

### Designs not appearing

1. Check `~/.dilag/sessions/{id}/screens/` for HTML files
2. Ensure the AI model has sufficient context
3. Check browser console for errors (DevTools in Tauri dev mode)

## License

MIT © 2025 Dilag Contributors

## Acknowledgments

- [Tauri](https://tauri.app) – Desktop runtime
- [OpenCode](https://opencode.ai) – AI integration
- [shadcn/ui](https://ui.shadcn.com) – Component library
- [React](https://react.dev) – UI framework

---

**Made with ❤️ for designers and developers**
