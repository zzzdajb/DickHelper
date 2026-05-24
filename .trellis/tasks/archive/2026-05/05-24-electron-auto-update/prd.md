# Add Electron Auto Update

## Goal

Add automatic update support to the Electron desktop app so installed users can discover, download, and apply new releases published from this repository.

## What I Already Know

* The user wants auto-update support for an existing Electron app.
* The user chose startup auto-check with user confirmation before downloading.
* The user requires support for Mainland China users with limited GitHub access.
* The user requested a selectable mirror option using `https://ghfast.top/` as a prefix, e.g. `https://ghfast.top/https://github.com/stilleshan/dockerfiles/archive/master.zip`.
* The user chose ghfast mirror as the default update source.
* The user chose transparent failure handling: if the selected update source fails, show an error and let the user switch source in Settings, instead of silently falling back.
* The user chose an in-app modal for startup update-available prompts.
* The user expects GitHub Release tags like `v2.0.4` to trigger packaging and update delivery to clients on `2.0.3`.
* Electron/electron-updater compares the packaged app version from `package.json.version` against the version in updater metadata, not the GitHub tag by itself.
* The app uses Electron 35, React 19, Vite/electron-vite, and electron-builder.
* The current package version is `2.0.0`.
* `electron-builder.yml` currently builds Windows NSIS, macOS DMG, and Linux AppImage.
* `.github/workflows/release.yml` already builds release assets for Windows, macOS, and Linux, then uploads them to GitHub Releases.
* The release workflow currently uses `npx electron-builder --publish=never` and uploads only renamed installer files.
* `README.md` says automatic update and packaging are not yet configured.
* Renderer access to Electron capabilities must go through the preload bridge.

## Assumptions

* GitHub Releases are the intended update distribution channel because the repo already has a GitHub release workflow.
* The MVP should avoid adding a separate update server.
* Update checks should be disabled in development unless explicitly testing packaged updates.
* The mirror source is the default first-launch source, but users can switch to direct GitHub.

## Open Questions

* None. Pending final user confirmation.

## Requirements (Evolving)

* Use the existing electron-builder based release pipeline as the base.
* Add an updater implementation that does not weaken the existing preload/contextIsolation security model.
* Ensure release publishing includes the metadata files required by update clients.
* Release tag format must be `vX.Y.Z`.
* Release workflow must verify `package.json.version` equals the tag without the `v` prefix before packaging.
* If `RELEASE_TAG=v2.0.4` but `package.json.version` is not `2.0.4`, the release workflow must fail before packaging.
* Present update state in a user-visible way, likely in Settings/About.
* On production startup, check for updates automatically.
* When a new version is available, show an in-app modal and ask whether to download it instead of downloading silently.
* If the user agrees, download the update and show progress/status.
* After download completes, let the user explicitly restart/apply the update.
* Add a Settings option for update source selection:
  * Direct GitHub Releases.
  * GitHub mirror via `https://ghfast.top/`.
* Default the update source to the ghfast mirror on first launch.
* Persist the selected update source across app restarts.
* If the selected update source fails, show a clear failure state/message.
* Do not automatically fall back from mirror to direct GitHub or from direct GitHub to mirror.
* Error messaging should tell the user they can switch update source in Settings.
* Settings/About should show current app version and update status/action controls.

## Acceptance Criteria (Evolving)

* [ ] Production packaged app can check GitHub Releases for a newer version.
* [ ] Release workflow rejects a `vX.Y.Z` tag when `package.json.version` is not `X.Y.Z`.
* [ ] Release workflow publishes updater metadata assets as well as installers.
* [ ] Renderer can display update status without importing Electron APIs directly.
* [ ] Startup check reports an available update without auto-downloading it.
* [ ] User sees an in-app modal when startup check finds an available update.
* [ ] User can choose to download or skip an available update from the modal.
* [ ] User can switch between direct GitHub and ghfast mirror sources from Settings.
* [ ] First launch uses the ghfast mirror as the default update source.
* [ ] The selected source is used for both update metadata and download URLs.
* [ ] The selected source persists after restart.
* [ ] Source failures do not automatically use a different source.
* [ ] Source failures show a clear message that points users to Settings.
* [ ] User has a clear path to restart/apply an already-downloaded update.
* [ ] `npm run build` and `npx tsc -b --noEmit` pass.

## Definition of Done

* Tests added or updated where practical for touched logic.
* Type-check and build pass.
* Release workflow changes follow `.trellis/spec/backend/ci-github-actions.md`.
* README is updated if the release/update behavior changes.
* Rollback and failure behavior are considered.

## Research References

* [`research/electron-auto-update-options.md`](research/electron-auto-update-options.md) - Compares official Electron/electron-builder update approaches and maps them to this repo.

## Technical Notes

* Relevant app files inspected: `package.json`, `electron-builder.yml`, `.github/workflows/release.yml`, `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/renderer/views/Settings.tsx`, `src/renderer/App.tsx`.
* Relevant specs inspected: `.trellis/spec/backend/index.md`, `.trellis/spec/backend/quality-guidelines.md`, `.trellis/spec/backend/ci-github-actions.md`, `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`.
* Recommended baseline: `electron-updater` + GitHub Releases + Settings/About UI.
* User-selected behavior maps to `autoUpdater.autoDownload = false`, manual `downloadUpdate()`, and `quitAndInstall()` only after `update-downloaded`.
* Mirror support likely requires runtime feed selection so both metadata and artifacts can be fetched through the chosen source.
* Direct generic feed should point at the GitHub release download endpoint for latest release assets. Mirror feed should prefix the same URL with `https://ghfast.top/`.
* Release workflow must preserve or publish asset filenames referenced by updater metadata; metadata and artifacts need to be mutually consistent.
* Version contract: `v2.0.4` tag is only valid when the built app's `package.json.version` is `2.0.4`.

## Technical Approach

Use `electron-updater` in the main process with explicit event handling instead of `checkForUpdatesAndNotify()`. Disable automatic downloads, check on production startup, send update state to the renderer through preload IPC, and let the renderer show a Mantine modal/action area. Persist the update source in main-process user config under `app.getPath("userData")`, defaulting to the ghfast mirror. Configure/reconfigure updater feed before checks so metadata and artifacts come from the selected source. Update the release workflow to publish updater metadata and matching artifacts.

The release workflow uses the GitHub tag as the release trigger only. Before packaging, it strips the leading `v` and checks that the repository `package.json.version` matches exactly. It does not mutate `package.json` during CI.

## Decision (ADR-lite, Evolving)

**Context**: Auto-update should not surprise users with an immediate download, and GitHub access may be unreliable for Mainland China users.

**Decision**: Use startup check with manual user confirmation before download. Show update availability with an in-app modal. Add a persistent Settings control for update source selection between direct GitHub and ghfast mirror. Default first launch to ghfast mirror. If the selected source fails, report the failure and let the user change source manually. Treat `package.json.version` as the authoritative application version and fail release packaging when it does not match the `vX.Y.Z` tag.

**Consequences**: The updater needs more explicit UI state than `checkForUpdatesAndNotify()`. Runtime feed/source selection must be tested carefully because the release metadata and artifact URLs must stay consistent.

## Out of Scope (Temporary)

* Dedicated update server or object storage hosting.
* Private update feed with user-machine `GH_TOKEN`.
* Complex staged rollout management.
* System notifications for update prompts.
* Automatic fallback between update sources.

## Implementation Plan

* PR1: Add `electron-updater`, builder publish/update metadata configuration, and release workflow asset publishing changes.
* PR2: Add main-process update service, persistent source config, preload IPC methods/events, and TypeScript declarations.
* PR3: Add Settings/About update source UI, update status controls, startup update modal, progress/error states, and README notes.
