#!/usr/bin/env bun
/**
 * Syncs version from package.json to tauri.conf.json and Cargo.toml
 * Called automatically by beforeBuildCommand in tauri.conf.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname!, "..");

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version = packageJson.version;

console.log(`Syncing version ${version} from package.json...`);

// Update tauri.conf.json
const tauriConfigPath = join(root, "src-tauri/tauri.conf.json");
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf-8"));
if (tauriConfig.version !== version) {
  tauriConfig.version = version;
  writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n");
  console.log(`✔ Updated src-tauri/tauri.conf.json to ${version}`);
} else {
  console.log(`✔ src-tauri/tauri.conf.json already at ${version}`);
}

// Update Cargo.toml
const cargoPath = join(root, "src-tauri/Cargo.toml");
let cargoContent = readFileSync(cargoPath, "utf-8");
const cargoVersionMatch = cargoContent.match(/^version\s*=\s*"([^"]+)"/m);
if (cargoVersionMatch && cargoVersionMatch[1] !== version) {
  cargoContent = cargoContent.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${version}"`
  );
  writeFileSync(cargoPath, cargoContent);
  console.log(`✔ Updated src-tauri/Cargo.toml to ${version}`);
} else {
  console.log(`✔ src-tauri/Cargo.toml already at ${version}`);
}
