import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import type { DesktopBridge } from "@dilag/desktop-bridge"

// Cleanup after each test case
afterEach(() => {
  cleanup()
})

const noopUnsubscribe = () => {}

const desktopBridgeMock: DesktopBridge = {
  app: { getInfo: vi.fn(), resetAllData: vi.fn() },
  agent: {
    getInfo: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    isRunning: vi.fn(),
    getProviderData: vi.fn(),
    listProviders: vi.fn(),
    setApiKey: vi.fn(),
    loginOAuthProvider: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    getMessages: vi.fn(),
    prompt: vi.fn(),
    abort: vi.fn(),
    clearQueue: vi.fn(),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    listQuestions: vi.fn(),
    replyQuestion: vi.fn(),
    rejectQuestion: vi.fn(),
    getTree: vi.fn(),
    forkSession: vi.fn(),
    navigateTree: vi.fn(),
    onEvent: vi.fn(() => noopUnsubscribe),
  },
  skills: { list: vi.fn(), preview: vi.fn(), install: vi.fn(), remove: vi.fn() },
  sessions: {
    createDir: vi.fn(),
    getCwd: vi.fn(),
    saveMeta: vi.fn(),
    loadMeta: vi.fn(),
    deleteMeta: vi.fn(),
    toggleFavorite: vi.fn(),
  },
  projects: {
    list: vi.fn(),
    create: vi.fn(),
    addExisting: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    touch: vi.fn(),
    getLegacyNotice: vi.fn(),
    dismissLegacyNotice: vi.fn(),
  },
  designs: {
    loadForSession: vi.fn(),
    copyBetweenSessions: vi.fn(),
    delete: vi.fn(),
    validateHtml: vi.fn(),
  },
  project: { listFiles: vi.fn(), readFile: vi.fn() },
  theme: { setTitlebarTheme: vi.fn() },
  zoom: {
    get: vi.fn(),
    set: vi.fn(),
    in: vi.fn(),
    out: vi.fn(),
    reset: vi.fn(),
    onChange: vi.fn(() => noopUnsubscribe),
  },
  menu: { onEvent: vi.fn(() => noopUnsubscribe), setState: vi.fn(() => Promise.resolve()) },
  dev: {
    onViteStdout: vi.fn(() => noopUnsubscribe),
    onViteError: vi.fn(() => noopUnsubscribe),
  },
  fs: { stat: vi.fn(), writeFile: vi.fn() },
  dialog: { save: vi.fn(), openDirectory: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
  updater: {
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    relaunch: vi.fn(),
  },
  bootstrap: { port: 4096 },
}

Object.defineProperty(window, "desktopBridge", {
  writable: true,
  value: desktopBridgeMock,
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, "localStorage", { value: localStorageMock })

// Mock matchMedia for responsive hooks
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
