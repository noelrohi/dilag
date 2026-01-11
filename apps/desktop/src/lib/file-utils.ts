import type { SupportedLanguages } from "@pierre/diffs";

/**
 * Map of file extensions to Shiki language identifiers
 */
const EXTENSION_MAP: Record<string, SupportedLanguages> = {
  // JavaScript/TypeScript
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",

  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  svg: "html",

  // Data formats
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",

  // Config files
  md: "markdown",
  mdx: "mdx",
  graphql: "graphql",
  gql: "graphql",

  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",

  // Other languages
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  r: "r",
  lua: "lua",
  vim: "vim",
  dockerfile: "dockerfile",
  makefile: "makefile",
};

/**
 * Special filenames that map to specific languages
 */
const FILENAME_MAP: Record<string, SupportedLanguages> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  gemfile: "ruby",
  rakefile: "ruby",
  ".gitignore": "text",
  ".gitattributes": "text",
  ".env": "bash",
  ".env.local": "bash",
  ".env.development": "bash",
  ".env.production": "bash",
  ".prettierrc": "json",
  ".eslintrc": "json",
  "tsconfig.json": "jsonc",
  "package.json": "json",
  "bun.lockb": "text",
};

/**
 * Infer the programming language from a filename
 * @param filename - The filename or path to analyze
 * @returns The Shiki language identifier, defaults to "text"
 */
export function inferLanguage(filename: string): SupportedLanguages {
  // Get the basename (last part of the path)
  const basename = filename.split("/").pop()?.toLowerCase() ?? "";

  // Check for exact filename matches first
  if (basename in FILENAME_MAP) {
    return FILENAME_MAP[basename];
  }

  // Extract extension
  const ext = basename.split(".").pop()?.toLowerCase();

  if (ext && ext in EXTENSION_MAP) {
    return EXTENSION_MAP[ext];
  }

  // Default to text for unknown files
  return "text";
}

/**
 * Get a short display name from a full file path
 * @param filePath - The full file path
 * @returns Just the filename without the path
 */
export function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

/**
 * Get a relative path by removing a common prefix
 * @param filePath - The full file path
 * @param basePath - The base path to remove
 * @returns The relative path
 */
export function getRelativePath(filePath: string, basePath?: string): string {
  if (!basePath) return filePath;
  
  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/$/, "");
  
  if (normalizedFile.startsWith(normalizedBase + "/")) {
    return normalizedFile.slice(normalizedBase.length + 1);
  }
  
  return filePath;
}
