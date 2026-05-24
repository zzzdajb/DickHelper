# Electron Auto Update Options

## Sources

* electron-builder Auto Update docs: https://www.electron.build/docs/features/auto-update/
* electron-builder electron-updater API docs: https://www.electron.build/docs/api/electron-updater/
* Electron Publishing and Updating tutorial: https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating

## Relevant Official Guidance

* `electron-updater` is the natural fit for this repository because the app already uses `electron-builder`. It supports Windows NSIS, macOS, and Linux AppImage, and electron-builder can generate the update metadata files.
* The updater package must be installed as an application/runtime dependency, not only as a dev dependency.
* For electron-builder, configure `publish` instead of calling Electron's `autoUpdater.setFeedURL`; builder writes the internal update config during packaging.
* `autoUpdater.autoDownload` defaults to `true`, but can be set to `false` so the app checks first and downloads only after user confirmation.
* `autoUpdater.downloadUpdate()` starts the manual download when `autoDownload` is `false`.
* `autoUpdater.quitAndInstall()` should only be called after the `update-downloaded` event.
* Windows NSIS is supported. This repo already uses `win.target: nsis`.
* macOS updater metadata requires a zip artifact. The current config explicitly sets only `dmg`, so the release config should include `zip` if macOS auto-update is in scope.
* GitHub release based updates require metadata assets such as `latest.yml`, `latest-mac.yml`, and `latest-linux.yml`. The current workflow only uploads renamed installers, so update clients would not have the metadata they need.
* GitHub draft releases are not visible to update clients; public non-draft releases are required for normal users.
* `setFeedURL()` can configure the update provider at runtime. The generic provider accepts a base URL. This is relevant for a user-selectable mirror source.

## Repository Constraints

* Current app version is `2.0.0` in `package.json` and the Settings screen hardcodes `v2.0.0`.
* Release workflow already builds Windows, macOS, and Linux artifacts on tag/release/workflow_dispatch.
* The workflow uses `npx electron-builder --publish=never`, then manually uploads one renamed asset per platform. This is good for downloads, but incomplete for `electron-updater`.
* The app uses `contextIsolation: true` and `nodeIntegration: false`; update status/actions must go through preload IPC if renderer UI is added.
* Mainland China users may have unreliable GitHub access. The user requested support for the proxy pattern `https://ghfast.top/<original GitHub URL>`, for example `https://ghfast.top/https://github.com/stilleshan/dockerfiles/archive/master.zip`.

## Feasible Approaches

### Approach A: electron-updater with GitHub Releases (recommended)

How it works: add `electron-updater`, configure `publish` in `electron-builder.yml`, wire updater checks in the main process, expose status/actions through preload, and update the release workflow to upload updater metadata alongside installers.

Pros:
* Matches existing electron-builder release pipeline.
* Supports progress and platform-specific update behavior.
* No dedicated update server.

Cons:
* CI release asset handling must change carefully.
* macOS auto-update requires zip output and practical signing/notarization decisions later.

Mirror extension:
* Generate and publish standard updater metadata to GitHub Releases.
* At runtime, let the user choose between the direct GitHub update feed and a ghfast-prefixed feed.
* Use a generic provider base URL for the selected source so metadata and update files resolve from the same base.

### Approach B: update-electron-app / update.electronjs.org

How it works: use Electron's hosted update service and `update-electron-app` package.

Pros:
* Minimal app code.
* Good fit for open-source apps hosted on public GitHub releases.

Cons:
* Primarily macOS/Windows focused in Electron's tutorial requirements.
* Less aligned with the existing electron-builder workflow and Linux AppImage target.
* Less control over in-app UI/status.

### Approach C: generic HTTPS update endpoint

How it works: host electron-builder artifacts and metadata on a static server or object storage bucket.

Pros:
* Avoids GitHub release/API constraints.
* Can support private distribution later.

Cons:
* Adds hosting/deployment work not present in this project.
* More operational surface for a first implementation.
