// IPC channel names shared between main and preload. No runtime behavior; the
// two processes are bundled separately so this file is inlined into each.
// Keep channel names namespaced (`<domain>:<verb>`) to avoid collisions.

export const CHANNELS = {
  app: {
    getInfo: "app:get-info",
    resetAllData: "app:reset-all-data",
  },
  agent: {
    getInfo: "agent:get-info",
    start: "agent:start",
    stop: "agent:stop",
    restart: "agent:restart",
    isRunning: "agent:is-running",
    getProviderData: "agent:get-provider-data",
    listProviders: "agent:list-providers",
    setApiKey: "agent:set-api-key",
    loginOAuthProvider: "agent:login-oauth-provider",
    createSession: "agent:create-session",
    listSessions: "agent:list-sessions",
    getSession: "agent:get-session",
    getMessages: "agent:get-messages",
    prompt: "agent:prompt",
    abort: "agent:abort",
    clearQueue: "agent:clear-queue",
    renameSession: "agent:rename-session",
    deleteSession: "agent:delete-session",
    listQuestions: "agent:list-questions",
    replyQuestion: "agent:reply-question",
    rejectQuestion: "agent:reject-question",
    getTree: "agent:get-tree",
    forkSession: "agent:fork-session",
    navigateTree: "agent:navigate-tree",
    event: "agent:event",
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
  projects: {
    list: "projects:list",
    create: "projects:create",
    addExisting: "projects:add-existing",
    update: "projects:update",
    remove: "projects:remove",
    touch: "projects:touch",
    getLegacyNotice: "projects:get-legacy-notice",
    importLegacy: "projects:import-legacy",
    dismissLegacyNotice: "projects:dismiss-legacy-notice",
  },
  designs: {
    loadForSession: "designs:load-for-session",
    copyBetweenSessions: "designs:copy-between-sessions",
    delete: "designs:delete",
    validateHtml: "designs:validate-html",
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
    setState: "menu:set-state",
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
    openDirectory: "dialog:open-directory",
  },
  shell: {
    openExternal: "shell:open-external",
    openPath: "shell:open-path",
    showItemInFolder: "shell:show-item-in-folder",
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
