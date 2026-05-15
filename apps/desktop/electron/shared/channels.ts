// IPC channel names shared between main and preload. No runtime behavior; the
// two processes are bundled separately so this file is inlined into each.
// Keep channel names namespaced (`<domain>:<verb>`) to avoid collisions.

export const CHANNELS = {
  app: {
    getInfo: "app:get-info",
    resetAllData: "app:reset-all-data",
  },
  opencode: {
    getPort: "opencode:get-port",
    start: "opencode:start",
    stop: "opencode:stop",
    restart: "opencode:restart",
    isRunning: "opencode:is-running",
    checkInstallation: "opencode:check-installation",
    checkBunInstallation: "opencode:check-bun-installation",
    installDependencies: "opencode:install-dependencies",
  },
  skills: {
    list: "skills:list",
    preview: "skills:preview",
    install: "skills:install",
    remove: "skills:remove",
  },
  sessions: {
    createDir: "sessions:create-dir",
    getCwd: "sessions:get-cwd",
    saveMeta: "sessions:save-meta",
    loadMeta: "sessions:load-meta",
    deleteMeta: "sessions:delete-meta",
    toggleFavorite: "sessions:toggle-favorite",
  },
  designs: {
    loadForSession: "designs:load-for-session",
    copyBetweenSessions: "designs:copy-between-sessions",
    delete: "designs:delete",
    validateHtml: "designs:validate-html",
    captureHtmlToImage: "designs:capture-html-to-image",
  },
  project: {
    listFiles: "project:list-files",
    readFile: "project:read-file",
  },
  theme: {
    setTitlebarTheme: "theme:set-titlebar-theme",
  },
  zoom: {
    get: "zoom:get",
    set: "zoom:set",
    in: "zoom:in",
    out: "zoom:out",
    reset: "zoom:reset",
    changed: "zoom:changed",
  },
  menu: {
    event: "menu:event",
  },
  dev: {
    viteStdout: "dev:vite-stdout",
    viteError: "dev:vite-error",
  },
  fs: {
    stat: "fs:stat",
    writeFile: "fs:write-file",
  },
  dialog: {
    save: "dialog:save",
  },
  shell: {
    openExternal: "shell:open-external",
  },
  updater: {
    check: "updater:check",
    download: "updater:download",
    install: "updater:install",
    relaunch: "updater:relaunch",
    progress: "updater:progress",
  },
  smoke: {
    report: "smoke:report",
  },
} as const
