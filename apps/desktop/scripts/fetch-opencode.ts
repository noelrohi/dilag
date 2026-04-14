#!/usr/bin/env bun
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const OPENCODE_VERSION = process.env.OPENCODE_VERSION ?? "1.4.3";

// Tauri sidecar target triples we support and their matching opencode release asset names.
const TARGETS: Record<string, string> = {
  "aarch64-apple-darwin": "opencode-darwin-arm64.zip",
  "x86_64-apple-darwin": "opencode-darwin-x64.zip",
};

const rootDir = resolve(import.meta.dirname, "..");
const binariesDir = join(rootDir, "src-tauri", "binaries");

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(dest, buf);
}

function run(cmd: string, args: string[], cwd?: string) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
}

async function fetchFor(triple: string, asset: string) {
  const destBin = join(binariesDir, `opencode-${triple}`);
  if (existsSync(destBin) && !process.env.FORCE) {
    console.log(`[fetch-opencode] ${destBin} already exists — skip (set FORCE=1 to redownload)`);
    return;
  }

  const tmpDir = join(binariesDir, `.tmp-${triple}`);
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const url = `https://github.com/sst/opencode/releases/download/v${OPENCODE_VERSION}/${asset}`;
  const zipPath = join(tmpDir, asset);
  console.log(`[fetch-opencode] ${triple} <- ${url}`);
  await download(url, zipPath);

  run("unzip", ["-q", "-o", zipPath, "-d", tmpDir]);

  const extractedBin = join(tmpDir, "opencode");
  if (!existsSync(extractedBin)) {
    throw new Error(`Archive for ${triple} did not contain an 'opencode' binary`);
  }

  await rm(destBin, { force: true });
  run("mv", [extractedBin, destBin]);
  await chmod(destBin, 0o755);

  if (process.platform === "darwin" && process.env.APPLE_SIGNING_IDENTITY) {
    console.log(`[fetch-opencode] codesign ${destBin}`);
    run("codesign", [
      "--force",
      "--timestamp",
      "--options",
      "runtime",
      "--sign",
      process.env.APPLE_SIGNING_IDENTITY,
      destBin,
    ]);
  } else if (process.platform === "darwin") {
    console.log(
      `[fetch-opencode] APPLE_SIGNING_IDENTITY unset — skipping codesign (OK for local dev, REQUIRED for release builds)`,
    );
  }

  await rm(tmpDir, { recursive: true, force: true });
  console.log(`[fetch-opencode] ready: ${destBin}`);
}

async function main() {
  await mkdir(binariesDir, { recursive: true });

  const only = process.env.OPENCODE_TARGET;
  const entries = Object.entries(TARGETS).filter(([t]) => !only || t === only);

  if (entries.length === 0) {
    throw new Error(`Unknown OPENCODE_TARGET: ${only}`);
  }

  for (const [triple, asset] of entries) {
    await fetchFor(triple, asset);
  }

  console.log(`[fetch-opencode] done (opencode v${OPENCODE_VERSION})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
