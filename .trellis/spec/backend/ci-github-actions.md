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
## Scenario: electron-builder packaging, update metadata, and asset naming

### 1. Scope / Trigger

Any release workflow that uses `electron-builder` to produce native executables and uploads them as GitHub Release assets. This includes the auto-update metadata consumed by `electron-updater`.

### 2. Signatures

```yaml
# electron-builder.yml
appId: com.york.dickhelper
productName: DickHelper
directories:
  output: dist
files:
  - out/**/*
publish:
  provider: generic
  url: https://github.com/zzzdajb/DickHelper/releases/latest/download/
win:
  target: nsis        # NOT portable — NSIS installs once, launches fast
mac:
  target:
    - dmg
    - zip             # Required for macOS auto-update metadata
linux:
  target: AppImage
```

### 3. Contracts

- `RELEASE_TAG` must match `^v[0-9]+[.][0-9]+[.][0-9]+$`.
- `package.json.version` must equal `RELEASE_TAG` without the leading `v`; fail before packaging if it does not.
- `npx electron-builder --publish=never` — generate packages and updater metadata, but do not let electron-builder upload anything directly.
- Do **not** rename electron-builder output files for GitHub Release upload. `latest*.yml` references the original output filenames.
- Windows assets: `dist/*.exe`, `dist/*.exe.blockmap`, `dist/latest.yml`.
- macOS assets: `dist/*.dmg`, `dist/*.zip`, `dist/*.zip.blockmap`, `dist/latest-mac.yml`.
- Linux assets: `dist/*.AppImage`, `dist/*.AppImage.blockmap`, `dist/latest-linux.yml`.
- Publish job uploads every downloaded asset with `gh release upload "$RELEASE_TAG" "${assets[@]}" --clobber --repo "$GH_REPO"`.

### 4. Asset Collection in Workflow

```yaml
- name: Validate package version
  shell: bash
  run: |
    set -euo pipefail
    RELEASE_VERSION="${RELEASE_TAG#v}"
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [[ "$PACKAGE_VERSION" != "$RELEASE_VERSION" ]]; then
      echo "::error::package.json version ($PACKAGE_VERSION) must match release tag without v ($RELEASE_VERSION)."
      exit 1
    fi

- name: Package with electron-builder
  shell: bash
  run: |
    set -euo pipefail
    shopt -s nullglob
    npx electron-builder --publish=never

    mkdir -p release-assets
    if [[ "${{ matrix.os-short }}" == "windows" ]]; then
      assets=(dist/*.exe dist/*.exe.blockmap dist/latest.yml)
    elif [[ "${{ matrix.os-short }}" == "macos" ]]; then
      assets=(dist/*.dmg dist/*.zip dist/*.zip.blockmap dist/latest-mac.yml)
    else
      assets=(dist/*.AppImage dist/*.AppImage.blockmap dist/latest-linux.yml)
    fi
    if [ ${#assets[@]} -eq 0 ]; then
      echo "::error::No release assets found in dist/"
      ls -la dist/ || true
      exit 1
    fi
    for asset in "${assets[@]}"; do
      cp "$asset" release-assets/
    done
```

### 5. Validation & Error Matrix

| Condition | Error |
|-----------|-------|
| `RELEASE_TAG=v2.0.4` but `package.json.version=2.0.3` | Workflow exits before packaging; updater would otherwise publish wrong version metadata |
| `files` excludes runtime dependencies | Packaged app cannot load externalized runtime packages |
| Using `portable` target on Windows | Single .exe extracts to temp dir on every launch — slow startup |
| Renaming installers but uploading original `latest*.yml` | Auto-update download fails because metadata points at filenames that are not in the release |
| Missing `latest.yml` / `latest-mac.yml` / `latest-linux.yml` | Clients cannot discover or validate updates |
| macOS config omits `zip` target | macOS auto-update metadata cannot point at the zip artifact expected by updater |

### 6. Tests Required

- Manual: Download each platform asset from release, install/run, verify app launches
- Manual: Verify `npm run build` produces `out/` directory with main/preload/renderer
- Manual: Push or dispatch `vX.Y.Z`, verify workflow fails when `package.json.version` is not `X.Y.Z`
- Manual: Verify GitHub Release contains updater metadata and every artifact referenced by the metadata
- Manual: Install `vX.Y.Z`, publish `vX.Y.(Z+1)`, verify the app detects the newer version

### 7. Wrong vs Correct

#### Wrong (renaming updater asset)
```bash
cp "dist/DickHelper Setup 2.0.4.exe" "release-assets/dickhelper-v2.0.4-windows.exe"
cp "dist/latest.yml" "release-assets/latest.yml"
# latest.yml still references "DickHelper Setup 2.0.4.exe", which is not in the release.
```

#### Correct (preserve metadata filenames)
```bash
cp "dist/DickHelper Setup 2.0.4.exe" release-assets/
cp "dist/DickHelper Setup 2.0.4.exe.blockmap" release-assets/
cp "dist/latest.yml" release-assets/
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
