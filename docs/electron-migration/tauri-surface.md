# Tauri API Surface Inventory

Generated for the Tauri → Electron migration (Phase 0). This is the complete set of host-side features the renderer relies on, which the new Electron preload bridge must replicate.

## 1. invoke commands (renderer → main)

Grouped by Rust module. Each row lists the command name, args as called from the renderer, return type, and source file.

### opencode (`src-tauri/src/opencode.rs`, 982 lines — the big one)

| Command                       | Args | Returns         | Renderer caller                                 |
| ----------------------------- | ---- | --------------- | ----------------------------------------------- |
| `check_opencode_installation` | —    | —               | setup wizard                                    |
| `check_bun_installation`      | —    | —               | setup wizard                                    |
| `install_dependencies`        | —    | —               | setup wizard                                    |
| `get_opencode_port`           | —    | `number`        | (via `window.__DILAG__.port` init script today) |
| `start_opencode_server`       | —    | `number` (port) | session startup                                 |
| `stop_opencode_server`        | —    | —               | shutdown                                        |
| `restart_opencode_server`     | —    | `number` (port) | session restart                                 |
| `is_opencode_running`         | —    | `boolean`       | health check                                    |

### skills (inside `opencode.rs`)

| Command                 | Args                    | Returns              |
| ----------------------- | ----------------------- | -------------------- |
| `list_installed_skills` | —                       | `SkillInfo[]`        |
| `preview_skills`        | —                       | `SkillPreviewResult` |
| `install_skill`         | —                       | `SkillInstallResult` |
| `remove_skill`          | `{ skillName: string }` | —                    |

### sessions (`src-tauri/src/sessions.rs`)

| Command                   | Args | Returns         |
| ------------------------- | ---- | --------------- |
| `create_session_dir`      | —    | `string` (path) |
| `get_session_cwd`         | —    | —               |
| `save_session_metadata`   | —    | `void`          |
| `load_sessions_metadata`  | —    | `SessionMeta[]` |
| `delete_session_metadata` | —    | `void`          |
| `toggle_session_favorite` | —    | `boolean`       |

### designs (`src-tauri/src/designs.rs`)

| Command                | Args                   | Returns        |
| ---------------------- | ---------------------- | -------------- |
| `load_session_designs` | —                      | `DesignFile[]` |
| `copy_session_designs` | `{ … }`                | —              |
| `delete_design`        | `{ filePath: string }` | —              |

### screen_validator (`src-tauri/src/screen_validator.rs`)

| Command                | Args | Returns |
| ---------------------- | ---- | ------- |
| `validate_screen_html` | —    | —       |

### capture (`src-tauri/src/capture.rs`)

| Command                 | Args | Returns |
| ----------------------- | ---- | ------- |
| `capture_html_to_image` | —    | —       |

### app_info (`src-tauri/src/app_info.rs`)

| Command          | Args | Returns   |
| ---------------- | ---- | --------- |
| `get_app_info`   | —    | `AppInfo` |
| `reset_all_data` | —    | —         |

### theme (`src-tauri/src/theme.rs`)

| Command              | Args                  | Returns |
| -------------------- | --------------------- | ------- |
| `set_titlebar_theme` | `{ isDark: boolean }` | —       |

### zoom (`src-tauri/src/zoom.rs`)

| Command          | Args                | Returns  |
| ---------------- | ------------------- | -------- |
| `set_zoom_level` | `{ level: number }` | `number` |
| `get_zoom_level` | —                   | —        |
| `zoom_in`        | —                   | `number` |
| `zoom_out`       | —                   | `number` |
| `zoom_reset`     | —                   | `number` |

**Total: 30 invoke commands across 8 modules.**

## 2. Events (main → renderer)

Emitted via `app.emit(...)` in `src-tauri/src/lib.rs`, subscribed via `listen(...)` in the renderer.

| Channel        | Payload                                                                                          | Emitter                                          | Listener                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `menu-event`   | `string` (event id: `settings`, `new-session`, `toggle-sidebar`, `toggle-chat`, `check-updates`) | menu handler in `lib.rs:81`                      | `context/menu-events.tsx`, `components/blocks/check-updates-menu-listener.tsx` |
| `zoom-changed` | `number`                                                                                         | zoom menu handler in `lib.rs:85/90/95`           | `hooks/use-zoom.ts`                                                            |
| `vite:error`   | `string`                                                                                         | **external** — Vite dev server / bundler wrapper | `components/blocks/errors/server-error-overlay.tsx:27`                         |
| `vite:stdout`  | `string`                                                                                         | **external** — Vite dev server / bundler wrapper | `components/blocks/errors/server-error-overlay.tsx:34`                         |

Note: `vite:error` / `vite:stdout` are emitted by a Vite dev-mode plugin (`vite-console-forward-plugin`). Not tied to Tauri runtime — but the transport today flows through the Tauri event bus. In Electron, we'll either keep `vite-console-forward-plugin` and bridge through `ipcRenderer` or swap to HMR's built-in error overlay.

## 3. Tauri plugins used in the renderer

| Plugin                                                            | Where                                                                            | Electron replacement                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `@tauri-apps/api/core` (`invoke`)                                 | widespread                                                                       | `window.desktopBridge.<method>` via preload `contextBridge` + `ipcMain.handle` |
| `@tauri-apps/api/event` (`listen`)                                | `menu-events`, `check-updates-menu-listener`, `use-zoom`, `server-error-overlay` | `ipcRenderer.on` wrapped in preload, or `EventTarget`-style subscription       |
| `@tauri-apps/plugin-opener` (`openUrl`)                           | `dialog-connect-provider`, `settings`, `skills`                                  | `shell.openExternal` in main, exposed via preload                              |
| `@tauri-apps/plugin-fs` (`stat`, `writeFile`)                     | `use-png-generator`, `design-export`                                             | `fs/promises` in main, exposed as `bridge.fs.*`                                |
| `@tauri-apps/plugin-dialog` (`save`)                              | `design-export`                                                                  | `dialog.showSaveDialog` in main                                                |
| `@tauri-apps/plugin-updater` (`check`, `Update`, `DownloadEvent`) | `updater-context`                                                                | `electron-updater` — re-wrap with the same hook API                            |
| `@tauri-apps/plugin-process` (`relaunch`)                         | `updater-context`                                                                | `app.relaunch(); app.exit(0)` in main                                          |

## 4. Window init script bridge

`src-tauri/src/lib.rs:49` injects `window.__DILAG__ = { port: <number> }` before the renderer loads. Several renderer modules rely on this.

**Electron equivalent:** set synchronously from the `BrowserWindow` bootstrap argument in preload:

```ts
contextBridge.exposeInMainWorld("__DILAG__", { port: bootstrapPort })
```

## 5. Native OS integrations

| Feature                                     | Tauri                                                                | Electron                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Titlebar overlay + traffic-light position   | `TitleBarStyle::Overlay`, `traffic_light_position` in `lib.rs:46–48` | `titleBarStyle: 'hiddenInset'` + `trafficLightPosition` on `BrowserWindow` |
| macOS window background color (oklch match) | `NSColor` via `objc2` in `lib.rs:57–69`                              | `BrowserWindow({ backgroundColor: '#070A0D' })` (hex approximation)        |
| Native menu                                 | `menu::setup_menu`                                                   | `Menu.setApplicationMenu`                                                  |

## 6. Sidecar binary

`src-tauri/tauri.conf.json:30` declares `externalBin: ["binaries/opencode"]`. The Electron migration moved those binaries to:

- `apps/desktop/resources/opencode/opencode-aarch64-apple-darwin`
- `apps/desktop/resources/opencode/opencode-x86_64-apple-darwin`

(Linux and Windows binaries are downloaded at build-time by `scripts/fetch-opencode.ts`.)

**Electron:** resolve `process.resourcesPath/opencode/<binary>` in packaged app or `apps/desktop/resources/opencode/<binary>` in dev. `electron-builder` `extraResources` config handles bundling.

## 7. Auto-updater

Tauri config (`tauri.conf.json:37–43`):

- Endpoint: `https://github.com/noelrohi/dilag/releases/latest/download/latest.json`
- Pubkey: minisign public key (base64)

**Electron:** `electron-updater` with `publish: { provider: 'github', owner: 'noelrohi', repo: 'dilag' }`. Uses GitHub release asset signatures (built-in), no minisign needed. During cutover we'll ship one release containing both `latest.json` (Tauri users) and `latest.yml`/`latest-mac.yml` (Electron users) so 0.5.x users can still auto-update to the first Electron build.

## 8. Tests mocking Tauri

Tests stub `@tauri-apps/api/core` and `@tauri-apps/plugin-opener`:

- `src/test/setup.ts:11`
- `src/components/blocks/setup/setup-wizard.test.tsx:6,10`
- `src/hooks/use-designs.test.ts:13`

After Phase 1 these should mock `window.desktopBridge` instead — the tests become decoupled from the shell.

## 9. Numbers at a glance

- 30 invoke commands
- 4 event channels (2 app-level, 2 Vite dev-only)
- 5 non-core plugins (`opener`, `fs`, `dialog`, `updater`, `process`)
- 14 Rust source files totalling ~2,100 lines
- 982 lines in `opencode.rs` alone (sidecar lifecycle + skills management)

## 10. Implied preload bridge shape (`DesktopBridge` type)

```ts
export type DesktopBridge = {
  app: {
    getInfo(): Promise<AppInfo>;
    resetAllData(): Promise<void>;
  };
  opencode: {
    getPort(): Promise<number>;
    start(): Promise<number>;
    stop(): Promise<void>;
    restart(): Promise<number>;
    isRunning(): Promise<boolean>;
    checkInstallation(): Promise<...>;
    checkBunInstallation(): Promise<...>;
    installDependencies(): Promise<...>;
  };
  skills: {
    list(): Promise<SkillInfo[]>;
    preview(): Promise<SkillPreviewResult>;
    install(): Promise<SkillInstallResult>;
    remove(name: string): Promise<void>;
  };
  sessions: {
    createDir(): Promise<string>;
    getCwd(): Promise<string>;
    saveMeta(meta: SessionMeta): Promise<void>;
    loadMeta(): Promise<SessionMeta[]>;
    deleteMeta(id: string): Promise<void>;
    toggleFavorite(id: string): Promise<boolean>;
  };
  designs: {
    load(sessionId: string): Promise<DesignFile[]>;
    copy(...): Promise<void>;
    delete(filePath: string): Promise<void>;
    validateHtml(...): Promise<...>;
    captureHtmlToImage(...): Promise<...>;
  };
  project: {
    listFiles(): Promise<FileNode[]>;
    readFile(path: string): Promise<string>;
  };
  theme: {
    setTitlebarTheme(isDark: boolean): Promise<void>;
  };
  zoom: {
    get(): Promise<number>;
    set(level: number): Promise<number>;
    in(): Promise<number>;
    out(): Promise<number>;
    reset(): Promise<number>;
    onChange(cb: (level: number) => void): () => void;
  };
  menu: {
    onEvent(cb: (id: string) => void): () => void;
  };
  fs: {
    stat(path: string): Promise<Stats>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
  };
  dialog: {
    save(opts: { defaultPath?: string; filters?: ... }): Promise<string | null>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  updater: {
    check(): Promise<UpdateInfo | null>;
    download(onProgress: (e: DownloadEvent) => void): Promise<void>;
    install(): Promise<void>;
    relaunch(): Promise<void>;
  };
  bootstrap: {
    port: number; // synchronous, injected before renderer loads
  };
};
```

This is the target Phase 1 will formalize in `packages/desktop-bridge`.
