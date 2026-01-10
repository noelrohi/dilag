---
description: Generate changelog and release a new version (patch/minor/major)
---

You are a release manager for Dilag. Automate the full release workflow including changelog generation.

## Context

Reference the CI/CD documentation for release process details:
@docs/ci.md

## Process

### Step 1: Gather Release Information

First, understand what has changed since the last release:

```bash
# Get the last release tag
git describe --tags --abbrev=0

# Get commits since last release
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# Get merged PRs with details
gh pr list --state merged --limit 20 --json number,title,mergedAt,labels --jq '.[] | "\(.number): \(.title)"'
```

### Step 2: Determine Version Bump

The user may specify the version type as an argument: `$1`

- If `$1` is `patch`, `minor`, or `major`, use that
- If `$1` is empty or not specified, analyze the changes:
  - **major**: Breaking changes (look for `!` in commits or BREAKING CHANGE)
  - **minor**: New features (`feat:` commits)
  - **patch**: Bug fixes and other changes (`fix:`, `perf:`, `refactor:`, etc.)

### Step 3: Generate Changelog Entry

Read the existing changelog to match the format:

```bash
head -50 CHANGELOG.md
```

Create a new version section following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- **Feature Name**: Brief description

### Changed
- **Component**: What changed

### Fixed
- **Bug**: What was fixed

### Removed
- Items that were removed
```

**Categorization rules:**
- `feat:` commits → **Added** (new features) or **Changed** (enhancements)
- `fix:` commits → **Fixed**
- `perf:` commits → **Changed** (performance improvements)
- `refactor:` commits → **Changed** (usually skip unless user-facing)
- `docs:` commits → Usually skip unless significant
- `chore:` commits → Usually skip (release commits, deps, etc.)

**Writing style:**
- Start with bold feature/component name
- Use concise descriptions (one line)
- Focus on user-facing impact, not implementation details
- Reference PR numbers where helpful: (#123)

### Step 4: Update CHANGELOG.md

Insert the new version section after line 7 (after the format description), before the previous version.

Use the Edit tool to prepend the new section above the most recent `## [X.Y.Z]` entry.

### Step 5: Commit Changelog

```bash
git add CHANGELOG.md
git commit -m "docs: add vX.Y.Z release notes to changelog"
```

### Step 6: Run Version Bump

Execute the release command with the determined version type:

```bash
bun release --$VERSION_TYPE
```

Where `$VERSION_TYPE` is `patch`, `minor`, or `major`.

This will:
1. Bump version in package.json
2. Sync to tauri.conf.json and Cargo.toml
3. Commit version changes
4. Create git tag (vX.Y.Z)
5. Push commit and tag to GitHub
6. Trigger CI release workflow

### Step 7: Confirm Release

```bash
git log -2 --oneline
git tag --sort=-version:refname | head -3
```

## Output

After completing the release:

1. Show the new version number
2. Show the changelog entry that was added
3. Confirm the tag was pushed
4. Provide the GitHub Actions URL: `https://github.com/noelrohi/dilag/actions`

Remind the user:
- CI will take ~20 minutes to build and notarize
- Release notes will be auto-populated from CHANGELOG.md by CI
- Check the release at: `https://github.com/noelrohi/dilag/releases`

## Guidelines

### Do:
- Match the existing changelog style exactly
- Group related changes together
- Write clear, user-focused descriptions
- Include PR numbers for traceability

### Don't:
- Include `chore: release vX.Y.Z` commits in changelog
- Include internal refactors unless user-facing
- Use vague descriptions like "various improvements"
- Forget to commit the changelog before running `bun release`
