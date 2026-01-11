import { defineConfig } from "bumpp";
import { execSync } from "child_process";

export default defineConfig({
  execute: () => {
    execSync("bun run sync-version-from-pkg", { stdio: "inherit" });
  },
  all: true,
});
