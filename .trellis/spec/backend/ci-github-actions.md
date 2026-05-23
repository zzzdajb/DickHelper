# GitHub Actions CI/CD Guidelines

> Concrete rules for writing `.github/workflows/*.yml` files. These prevent silent failures in CI/CD pipelines.

---

## Scenario: Release workflow with artifact upload/download

### 1. Scope / Trigger

Any workflow that uses both `actions/upload-artifact` and `actions/download-artifact` in separate jobs, plus `gh` CLI for release management.

### 2. Signatures

```yaml
# Required permissions at workflow level
permissions:
  contents: read
  actions: read

# Job using upload-artifact
release-build:
  permissions:
    contents: read
    actions: write

# Job using download-artifact + gh release
publish-release:
  permissions:
    contents: write
    actions: read
```

### 3. Contracts

- `actions: write` — required by `actions/upload-artifact@v4`
- `actions: read` — required by `actions/download-artifact@v4`
- `contents: write` — required by `gh release create` / `gh release upload`
- `gh release upload <tag> <files...> --clobber --repo <owner/repo>` — upload assets to existing release
- `gh release create <tag> <files...> --title <tag> --generate-notes --repo <owner/repo>` — create release with assets

### 4. Validation & Error Matrix

| Condition | Error |
|-----------|-------|
| Missing `actions: write` on artifact upload job | Artifact upload silently degrades or fails |
| Missing `actions: read` on artifact download job | `download-artifact` cannot find artifacts from sibling jobs |
| Missing `--repo` on `gh` command in job without checkout | `gh` has no git remote to resolve repo, command fails or targets wrong repo |
| `gh release view` fails to find release | Fallback to `gh release create` (release doesn't exist yet) |
| No `.zip` files in `release-assets/` | Exit 1 with `::error::` annotation |

### 5. Good/Base/Bad Cases

**Good**: All permissions declared explicitly, `--repo` on every `gh` command, direct env var usage.
**Base**: Permissions at workflow level only, gh commands without `--repo`, intermediate env var aliasing.
**Bad**: No `actions` permission declared, `gh release upload` targeting wrong repo.

### 6. Tests Required

- Manual: Push a `v*.*.*` tag, verify release is created with assets
- Manual: Edit an existing release, verify assets are updated
- Manual: Run workflow via `workflow_dispatch` with a tag input, verify assets uploaded

### 7. Wrong vs Correct

#### Wrong
```yaml
# Missing actions permission — download-artifact will fail in restrictive token mode
permissions:
  contents: read

publish-release:
  permissions:
    contents: write
  steps:
    - run: |
        gh release upload "$TAG" assets/*.zip --clobber
        # No --repo flag — fails in jobs without code checkout
```

#### Correct
```yaml
permissions:
  contents: read
  actions: read

release-build:
  permissions:
    contents: read
    actions: write

publish-release:
  permissions:
    contents: write
    actions: read
  steps:
    - run: |
        gh release upload "$RELEASE_TAG" "${assets[@]}" --clobber --repo "$GH_REPO"
```

---

## Design Decision: Separate CI and Release workflows

**Context**: CI (branch pushes, PRs) and release publishing (tags, release events) have different triggers, permissions, and output expectations.

**Decision**: Keep `ci.yml` (main/PR only) separate from `release.yml` (tags/release events/workflow_dispatch).

**Why**: CI needs `contents: read` only. Release needs `contents: write`. Merging them would require broader permissions for all runs, weakening security.

---

---
## Scenario: electron-builder packaging and asset naming

### 1. Scope / Trigger

Any release workflow that uses `electron-builder` to produce native executables and uploads them as release assets.

### 2. Signatures

```yaml
# electron-builder.yml
appId: com.york.dickhelper
productName: DickHelper
directories:
  output: dist
files:
  - out/**/*
win:
  target: nsis        # NOT portable — NSIS installs once, launches fast
mac:
  target: dmg
linux:
  target: AppImage
```

### 3. Contracts

- `npx electron-builder --publish=never` — build without publishing to auto-update channels
- Windows output: `dist/DickHelper Setup X.X.X.exe` (NSIS installer)
- macOS output: `dist/DickHelper-X.X.X.dmg`
- Linux output: `dist/DickHelper-X.X.X.AppImage`
- Asset naming: `dickhelper-$TAG-$PLATFORM.$EXT` (note the `.` before `${ASSET##*.}`)

### 4. Asset Collection in Workflow

```yaml
- name: Package with electron-builder
  shell: bash
  run: |
    set -euo pipefail
    npx electron-builder --publish=never
    mkdir -p release-assets
    ASSET=""
    if [[ "${{ matrix.os-short }}" == "windows" ]]; then
      ASSET=$(ls dist/DickHelper*.exe | head -1)
    elif [[ "${{ matrix.os-short }}" == "macos" ]]; then
      ASSET=$(ls dist/DickHelper*.dmg | head -1)
    else
      ASSET=$(ls dist/DickHelper*.AppImage | head -1)
    fi
    cp "$ASSET" "release-assets/dickhelper-${{ env.RELEASE_TAG }}-${{ matrix.os-short }}.${ASSET##*.}"
```

### 5. Validation & Error Matrix

| Condition | Error |
|-----------|-------|
| `files` only contains `out/**/*` | Electron runtime NOT bundled — app won't launch |
| Using `portable` target on Windows | Single .exe extracts to temp dir on every launch — slow startup |
| Missing `.` before `${ASSET##*.}` | Output file named `windows.exe` instead of `windows.exe` |
| Multiple .exe files matched by glob | `head -1` picks first; may pick wrong file (unlikely with clean dist/) |

### 6. Tests Required

- Manual: Download each platform asset from release, install/run, verify app launches
- Manual: Verify `npm run build` produces `out/` directory with main/preload/renderer

### 7. Wrong vs Correct

#### Wrong (missing dot)
```bash
cp "$ASSET" "release-assets/dickhelper-$TAG-$PLATFORM${ASSET##*.}"
# Produces: dickhelper-v2.0.0-windowsexe  (no dot!)
```

#### Correct
```bash
cp "$ASSET" "release-assets/dickhelper-$TAG-$PLATFORM.${ASSET##*.}"
# Produces: dickhelper-v2.0.0-windows.exe
```

---

## Convention: `gh` CLI in GitHub Actions

**What**: Always use `--repo "$GH_REPO"` (or `${{ github.repository }}`) in `gh` commands within jobs that do NOT run `actions/checkout`.

**Why**: `gh` resolves the target repo from the local git remote when available. Jobs without a checkout (like `publish-release` that only downloads artifacts) have no local git repo, so `gh` may fail or silently target the wrong repo. The `--repo` flag removes this ambiguity.

**Example**:
```yaml
- name: Upload to release
  env:
    GH_TOKEN: ${{ github.token }}
    GH_REPO: ${{ github.repository }}
  run: |
    gh release upload "$TAG" *.zip --clobber --repo "$GH_REPO"
    gh release view "$TAG" --repo "$GH_REPO"
```

---

## Gotcha: Intermediate env var aliasing

> **Warning**: Avoid creating a step-level `env` alias (e.g., `TAG_NAME: ${{ env.RELEASE_TAG }}`) that just copies a job-level env var. Every indirection is a failure point — use `$RELEASE_TAG` directly in scripts.
>
> The job-level `env.RELEASE_TAG` is already available in all steps. A step-level alias adds no value and creates a second variable to keep in sync.
