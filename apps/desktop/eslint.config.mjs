import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

const unusedVarsOptions = {
  args: "after-used",
  argsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
  caughtErrorsIgnorePattern: "^_",
  destructuredArrayIgnorePattern: "^_",
  ignoreRestSiblings: true,
}

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-electron/**",
      "release/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", unusedVarsOptions],
      // `any` is pre-existing debt (DOM type shims, provider-prop casts, tests).
      // Deliberately deferred to a follow-up pass alongside type-aware rules so
      // this first landing focuses on the high-signal rules (hooks, unused vars).
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Node-side JavaScript: build/dev scripts and this config file.
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-unused-vars": ["error", unusedVarsOptions] },
  },
  // Renderer code runs in the browser.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
