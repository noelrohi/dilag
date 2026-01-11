#!/usr/bin/env bun
/**
 * Syncs version from package.json to tauri.conf.json and Cargo.toml
 * Called by bumpp via the execute option: bumpp --execute "bun run sync-version %s"
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const version = process.argv[2];

if (!version) {
  console.error("Usage: bun scripts/sync-version.ts <version>");
  process.exit(1);
}

const root = join(import.meta.dirname!, "..");

// Update tauri.conf.json
const tauriConfigPath = join(root, "src-tauri/tauri.conf.json");
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf-8"));
tauriConfig.version = version;
writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n");
console.log(`✔ Updated src-tauri/tauri.conf.json to ${version}`);

// Update Cargo.toml
const cargoPath = join(root, "src-tauri/Cargo.toml");
let cargoContent = readFileSync(cargoPath, "utf-8");
cargoContent = cargoContent.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`
);
writeFileSync(cargoPath, cargoContent);
console.log(`✔ Updated src-tauri/Cargo.toml to ${version}`);
