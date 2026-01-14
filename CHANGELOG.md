# Changelog

All notable changes to Dilag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-01-15

### Added

- **Update Check Menu Listener**: New component to trigger update checks from the Help menu

### Changed

- **Setup Wizard**: Update checks are now enabled during the setup wizard for immediate availability

## [0.4.0] - 2026-01-14

### Added

- **Desktop-to-Web Authentication**: Sign in via browser and return to the desktop app using deep links (#50)
- **Onboarding & Download Pages**: Added onboarding, download, and success pages for the license flow (#50)
- **Legal Pages**: Added cookies, privacy, and terms pages (#50)
- **License Key API**: Added API endpoints for license keys and onboarding (#50)
- **License Activation Deep Links**: Added deep link support for license activation in the desktop app (#50)

### Changed

- **Website Auth UI**: Updated branding and layout across auth-related pages (#50)

### Fixed

- **Licensing & Purchase Flow**: Improved Polar purchase flow handling and deep-link redirects (#50)
- **License Gate**: Updated the license gate component behavior and UI (#50)
- **Desktop Licensing Backend**: Always uses production Polar configuration (#50)

## [0.3.9] - 2026-01-14

### Added

- **Activity Indicators**: Visual feedback for loading states and ongoing operations (#49)
- **Mobile Sidebar**: Improved sidebar navigation for mobile-responsive views (#49)
- **Session Metadata**: Enhanced session information display with additional context (#49)

### Fixed

- **Polar API Calls**: Remove deprecated organizationId parameter from API requests (#48)

## [0.3.8] - 2026-01-14

### Added

- **PNG Export**: Export designs as PNG images directly from the canvas (#46)
- **Auto-Install Dependencies**: Automatically install project dependencies when opening a session (#47)

### Changed

- **Design Prompts**: Cleaner, more focused prompts for AI-generated designs (#46)

### Fixed

- **Canvas Refresh**: Nodes now properly refresh when file content changes (#45)

## [0.3.7] - 2026-01-13

### Fixed

- **Chat View File Tags**: Handle hyphenated file tags correctly in chat view (#44)

## [0.3.6] - 2026-01-13

### Added

- **OpenGraph Image**: Social sharing cards for website with branded preview images

### Fixed

- **Theme-Aware Containers**: Iframe containers now use theme-aware background colors for consistent dark/light mode (#43)

## [0.3.5] - 2026-01-13

### Changed

- **Website Downloads**: Direct download links for macOS DMG, improving download experience (#41)

## [0.3.4] - 2026-01-13

### Added

- **Window Maximization**: App now maximizes by default with zoom controls for canvas navigation (#40)
- **Session Favorites**: Favorite sessions for quick access with redesigned sidebar navigation (#39)
- **Screens Directory**: Automatically creates screens directory when initializing a session (#38)

### Fixed

- **Website Favicon**: Now uses the app icon as favicon for consistent branding (#37)

## [0.3.3] - 2026-01-12

### Added

- **Canvas Interactions**: Screen selection, drag-and-drop positioning, and keyboard navigation on the design canvas (#36)
- **Screen Reference System**: Reference other screens in prompts for contextual design generation (#36)

## [0.3.2] - 2026-01-12

### Added

- **URL State Management**: Platform selection now persists in URL query string via nuqs, enabling shareable URLs and browser navigation (#35)

### Changed

- **Skill Invocation**: Simplified skill hint format, now only prepends on first message of a session (#35)

### Fixed

- **Thinking Mode Selector**: Added proper button type to prevent unintended form submissions (#35)

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
