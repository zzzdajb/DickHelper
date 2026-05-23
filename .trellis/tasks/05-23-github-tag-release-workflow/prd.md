# Fix GitHub tag release workflow

## Goal

Make GitHub Actions publish a compressed release automatically whenever a version tag such as `v2.0.1` is pushed. The workflow should also stop failing at dependency installation because `package.json` and `package-lock.json` are out of sync.

## Requirements

* Keep CI behavior for `main` pushes and pull requests.
* Trigger release publishing only for `v*.*.*` tags.
* Allow manual reruns for an existing version tag through `workflow_dispatch`.
* Rebuild and re-upload release assets when an existing published Release is edited.
* Install dependencies in CI with `npm ci`, after refreshing `package-lock.json` so it matches `package.json`.
* Build the existing Electron/Vite output with `npm run build`.
* Compress the existing `out/` build directory per runner OS.
* Create or update a GitHub Release for the pushed tag and upload the compressed build asset.
* Avoid introducing electron-builder or installer packaging in this task.

## Acceptance Criteria

* [ ] `npm ci` passes locally after the lockfile refresh.
* [ ] `npm run build` passes locally.
* [ ] `.github/workflows/ci.yml` has a tag-only release job.
* [ ] Existing version tags can be rebuilt manually by providing the tag input.
* [ ] Editing an existing published Release triggers a rebuild for that release tag.
* [ ] Release assets are named predictably by tag and OS.
* [ ] The workflow grants only the permissions needed to create a release.

## Definition of Done

* Workflow file updated.
* Lockfile synchronized with package manifest.
* Local install/build verification passes.
* No unrelated source files are changed.

## Out of Scope

* electron-builder/electron-forge packaging.
* Auto-update support.
* Code signing/notarization.
* Installer artifacts such as `.exe`, `.dmg`, `.AppImage`, or `.deb`.

## Technical Notes

* Current workflow: `.github/workflows/ci.yml`.
* Current build output: `out/`, per README.
* `package.json` currently declares `@electron/rebuild`, but the lockfile root entry was stale, causing `npm ci` EUSAGE.
* Use GitHub CLI `gh release create` because it is available on GitHub-hosted runners and can upload release assets directly.
