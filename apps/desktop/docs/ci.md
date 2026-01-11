# CI/CD & Release Pipeline

Documentation for the release workflow, versioning, and code signing.

---

## Table of Contents

1. [Release Workflow](#release-workflow)
2. [Versioning](#versioning)
3. [Code Signing & Notarization](#code-signing--notarization)
4. [Auto-Updates](#auto-updates)
5. [GitHub Secrets](#github-secrets)
6. [Troubleshooting](#troubleshooting)

---

## Release Workflow

### Trigger

The release workflow (`.github/workflows/release.yml`) triggers on version tags:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

### How to Release

```bash
bun release
```

This runs `bumpp` which:
1. Prompts for version bump type (patch/minor/major)
2. Updates version in `package.json`
3. Commits the change
4. Creates a git tag (e.g., `v0.2.8`)
5. Pushes commit and tag to GitHub
6. Triggers the release workflow

### Workflow Jobs

```
┌─────────────────────────────────────────────────────────────────┐
│                     publish-tauri (matrix)                       │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ macos-latest            │  │ macos-latest            │      │
│  │ aarch64-apple-darwin    │  │ x86_64-apple-darwin     │      │
│  │                         │  │                         │      │
│  │ 1. Checkout             │  │ 1. Checkout             │      │
│  │ 2. Setup Bun            │  │ 2. Setup Bun            │      │
│  │ 3. Setup Rust           │  │ 3. Setup Rust           │      │
│  │ 4. Import Certificate   │  │ 4. Import Certificate   │      │
│  │ 5. Install deps         │  │ 5. Install deps         │      │
│  │ 6. tauri-action build   │  │ 6. tauri-action build   │      │
│  │ 7. Upload artifacts     │  │ 7. Upload artifacts     │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  Both jobs run in parallel (~15-20 min each)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    update-latest-json                            │
│                                                                 │
│  1. Download artifacts from both build jobs                     │
│  2. Generate dilag-latest.json (updater manifest)               │
│  3. Upload to GitHub Release                                    │
└─────────────────────────────────────────────────────────────────┘
```

### tauri-apps/tauri-action

We use the official [tauri-action](https://github.com/tauri-apps/tauri-action) which:
- **Caches the Tauri CLI** - Avoids slow `cargo install` on every build
- **Handles building** - Runs `cargo tauri build` with proper flags
- **Creates/updates releases** - Uploads DMG, tar.gz, and signature files
- **Signs the app** - Uses provided Apple credentials

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  with:
    tagName: ${{ github.ref_name }}
    releaseName: "Dilag ${{ github.ref_name }}"
    args: --target aarch64-apple-darwin
```

---

## Versioning

### Multi-File Version Bump

`bumpp` is configured via `bump.config.ts` to sync all version files:

```ts
// bump.config.ts
import { defineConfig } from "bumpp";
import { execSync } from "child_process";

export default defineConfig({
  execute: () => {
    execSync("bun run sync-version-from-pkg", { stdio: "inherit" });
  },
  all: true,
});
```

When you run `bun release`, bumpp:
1. Bumps `package.json` version
2. Runs the sync script to update other files
3. Commits all changes together (via `all: true`)
4. Creates git tag and pushes

### Files Involved

| File | Role |
|------|------|
| `package.json` | Source of truth, bumped by `bumpp` |
| `src-tauri/tauri.conf.json` | Synced by execute hook |
| `src-tauri/Cargo.toml` | Synced by execute hook |

### Sync Script

The `sync-version-from-pkg` script (`scripts/sync-version-from-pkg.ts`) reads the version from `package.json` and updates `tauri.conf.json` and `Cargo.toml`.

### CI Fallback

The `beforeBuildCommand` also runs the sync script as a safety net:

```json
"beforeBuildCommand": "bun run sync-version-from-pkg && bun run build"
```

---

## Code Signing & Notarization

### macOS Requirements

Apple requires apps distributed outside the App Store to be:
1. **Code signed** - With a Developer ID certificate
2. **Notarized** - Submitted to Apple for malware scanning

Without these, users see "Apple cannot verify this app" warnings.

### Certificate Import

The workflow imports the Apple certificate into a temporary keychain:

```yaml
- name: Import Apple Certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
    KEYCHAIN_PASSWORD=$(openssl rand -base64 32)
    
    echo "$APPLE_CERTIFICATE" | base64 --decode > $RUNNER_TEMP/certificate.p12
    
    security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
    security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
    
    security import $RUNNER_TEMP/certificate.p12 -P "$APPLE_CERTIFICATE_PASSWORD" \
      -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
    security set-key-partition-list -S apple-tool:,apple: \
      -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
    security list-keychain -d user -s $KEYCHAIN_PATH
```

### Notarization

Tauri automatically notarizes when these env variables are set:
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD` (app-specific password)
- `APPLE_TEAM_ID`

Notarization process:
1. Tauri builds and signs the app
2. Uploads to Apple's notarization service
3. Waits for approval (usually 2-5 minutes)
4. Staples the notarization ticket to the app

---

## Auto-Updates

### Tauri Updater

Dilag uses Tauri's built-in updater plugin. Configuration in `tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/noelrohi/dilag/releases/latest/download/dilag-latest.json"
    ],
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6..."
  }
}
```

### Update Manifest (`dilag-latest.json`)

Generated by the `update-latest-json` job and uploaded to each release:

```json
{
  "version": "0.2.8",
  "notes": "Release v0.2.8",
  "pub_date": "2025-12-19T10:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "base64-encoded-signature...",
      "url": "https://github.com/noelrohi/dilag/releases/download/v0.2.8/Dilag_0.2.8_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "base64-encoded-signature...",
      "url": "https://github.com/noelrohi/dilag/releases/download/v0.2.8/Dilag_0.2.8_x64.app.tar.gz"
    }
  }
}
```

### Update Flow in App

```
App launches
    │
    └── UpdaterProvider mounts
        │
        ├── Wait 3 seconds (don't block startup)
        │
        ├── Fetch dilag-latest.json from GitHub
        │
        ├── Compare versions
        │
        └── If update available:
            │
            ├── Show toast: "Update v0.2.8 available"
            │   └── Action button: "Update Now"
            │
            └── On click "Update Now":
                ├── Download .app.tar.gz
                ├── Verify signature
                ├── Extract and replace app
                └── Relaunch
```

### Signing Keys

The updater uses minisign for verifying updates:
- **Private key**: `TAURI_SIGNING_PRIVATE_KEY` (in GitHub secrets)
- **Public key**: Embedded in `tauri.conf.json` → `plugins.updater.pubkey`

Updates are rejected if the signature doesn't match.

---

## GitHub Secrets

Required secrets in repository settings:

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign private key for update signatures |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for signing key (can be empty) |
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file |
| `APPLE_SIGNING_IDENTITY` | Certificate name (e.g., "Developer ID Application: Name (TEAM_ID)") |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | 10-character team identifier |

### Generating Secrets

**Tauri signing key:**
```bash
cargo tauri signer generate -w ~/.tauri/dilag.key
# Copy private key content to TAURI_SIGNING_PRIVATE_KEY
# Copy public key to tauri.conf.json plugins.updater.pubkey
```

**Apple certificate:**
```bash
# Export from Keychain Access as .p12
base64 -i certificate.p12 | pbcopy
# Paste as APPLE_CERTIFICATE
```

**App-specific password:**
1. Go to https://appleid.apple.com/account/manage
2. Generate app-specific password
3. Use as `APPLE_PASSWORD`

---

## Troubleshooting

### Build Fails: "Unable to resolve action"

**Error:** `Unable to resolve action tauri-apps/tauri-action@v1`

**Fix:** Use `@v0` instead of `@v1`:
```yaml
uses: tauri-apps/tauri-action@v0
```

### Version Mismatch in App

**Symptom:** App shows old version after installing new release

**Cause:** `tauri.conf.json` wasn't synced before build

**Fix:** Ensure `beforeBuildCommand` includes version sync:
```json
"beforeBuildCommand": "bun run sync-version-from-pkg && bun run build"
```

### "Apple cannot verify this app"

**Cause:** App not notarized or certificate not trusted

**Fixes:**
1. Ensure all `APPLE_*` secrets are set correctly
2. Check workflow logs for notarization errors
3. Verify certificate is "Developer ID Application" type

### Update Check Fails

**Symptom:** App doesn't detect available updates

**Checks:**
1. Verify `dilag-latest.json` exists in release assets
2. Check endpoint URL in `tauri.conf.json` is correct
3. Ensure repo is public (private repos need auth)

### Signature Verification Failed

**Symptom:** Update downloads but fails to install

**Cause:** Signature mismatch between build and pubkey

**Fix:** Ensure `TAURI_SIGNING_PRIVATE_KEY` matches the pubkey in `tauri.conf.json`

---

## Build Times

Typical durations on GitHub-hosted `macos-latest`:

| Step | Duration |
|------|----------|
| Setup (checkout, rust, bun) | ~2 min |
| Install dependencies | ~1 min |
| Tauri build (first time) | ~15 min |
| Tauri build (cached) | ~8 min |
| Notarization | ~3-5 min |
| **Total per architecture** | **~20-25 min** |

Both architectures build in parallel, so total workflow time ≈ single build time.
