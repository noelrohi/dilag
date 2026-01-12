# Changelog

All notable changes to Dilag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-01-12

### Changed

- **Monorepo Structure**: Reorganized project into `apps/desktop`, `apps/web`, and `packages/shared` workspaces (#30)
- **Website**: Revamped marketing pages with improved design and moved documentation (#33)

### Fixed

- **Website**: Corrected heading font override and updated footer Twitter link (#34)
- **Build**: Added environment variables to turbo.json for Vercel deployments (#31)
- **License Gate**: Footer now displays dynamic version instead of hardcoded value (#29)

## [0.3.0] - 2026-01-11

### Added

- **Infinite Canvas**: Pan and zoom design studio with platform-aware screen rendering (#27)
- **Platform Support**: Generate designs for iOS, Android, macOS, Windows, Web, and Tablet (#27)

### Changed

- **Rebrand**: Dilag is now an "AI-powered design studio" for mobile and web apps (#28)

## [0.2.2] - 2026-01-10

### Added

- **Turn-Based Timing**: Message generation now displays timing per turn with improved UX (#26)

## [0.2.1] - 2026-01-10

### Added

- **Release Automation**: GitHub release notes now auto-populated from changelog (#25)

### Fixed

- **Process Spawning**: Augmented PATH for spawned processes in production builds (#24)

## [0.2.0] - 2026-01-10

### Added

- **Code Preview**: File tree navigator and syntax-highlighted code viewer for generated projects
- **Permission Prompts**: Interactive UI for agent permission requests with approve/deny actions
- **Question Prompts**: Multi-choice question UI for agent interactions with session state management
- **Agent Selector**: Dropdown to switch between available agents in studio
- **Model Selector**: UI to choose AI model for generation
- **Resizable Panels**: Draggable dividers between studio panels

### Changed

- **Web Template**: Enhanced AGENTS.md with better guidance and switched to Lucide icons
- **Studio Layout**: Improved panel organization with resizable sections

## [0.1.0] - 2025-01-07

### Added

- **Web Preview Mode**: Live Vite dev server integration with hot module replacement
- **Browser Frame**: Embedded iframe preview with viewport controls (Desktop/Tablet/Mobile)
- **Build Agent**: New skill-based agent for web application generation
- **Web Project Template**: Bundled Vite + React + TanStack Router + Tailwind CSS template
- **Error Boundary**: Runtime error catching in generated web projects
- **Bun Dependency Check**: Setup wizard now verifies Bun installation
- **Skill Tool**: Added frontend-design skill to tool registry
- **Session Title Sync**: Automatically sync titles from OpenCode via SSE events
- **Test Infrastructure**: Added Vitest with HappyDOM for component testing

### Changed

- **Architecture Shift**: Moved from mobile design canvas to web app builder
- **Agent System**: Replaced designer/web-designer agents with unified build agent
- **UI Copy**: Updated terminology from "design" to "build" throughout
- **Landing Page**: Redesigned suggestion buttons with color gradients
- **Project Cards**: Simplified layout with relative timestamps ("2h ago")
- **Empty States**: Streamlined placeholder text across views
- **Icon Library**: Switched web template from Lucide to Solar Icons

### Removed

- Mobile design canvas and iPhone frames
- DraggableScreen and MobileFrame components
- DesignCanvas infinite canvas with pan/zoom
- HTML file polling (replaced by Vite HMR)
- Designer agent prompt (replaced by skill system)

### Fixed

- Template path resolution now prioritizes dev paths for local development
- Session status updates are more reliable via SSE event subscription

## [0.0.16] - 2024-12-XX

- Previous mobile UI design studio release
