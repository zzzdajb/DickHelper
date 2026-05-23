# Fix Electron Startup White Screen

## Goal

The Electron desktop app should render normally after startup instead of showing a blank screen. The fix should target the startup crash path with minimal scope and preserve the existing Electron + React + SQLite architecture.

## What I Already Know

* The user reported that the Electron app shows a white screen after launch.
* The app uses `electron-vite` with `src/main`, `src/preload`, and `src/renderer` entry points.
* `src/main/index.ts` loads the dev server in development and `out/renderer/index.html` in production.
* `src/preload/index.ts` exposes `window.electronAPI` through `contextBridge`.
* `src/renderer/services/DatabaseService.ts` currently implements `GetApi()` by recursively calling `GetApi()` instead of reading `window.electronAPI`, which can crash the renderer when database APIs are first used.
* `electron.vite.config.ts` builds preload as CommonJS, producing `out/preload/index.cjs`.
* `src/main/index.ts` was still loading `out/preload/index.js`, so `npm run dev` failed to load preload and left `window.electronAPI` undefined.

## Requirements

* Fix the renderer-side API accessor so it reads `window.electronAPI`.
* Fix the BrowserWindow preload path so it matches the actual CommonJS build output.
* Preserve the explicit error message when the preload API is unavailable.
* Keep the change minimal and compatible with context isolation.
* Verify the application type-checks/builds after the fix.

## Acceptance Criteria

* [ ] `DatabaseService.GetApi()` no longer recurses.
* [ ] `npm run dev` loads `out/preload/index.cjs` without ENOENT.
* [ ] The first rendered view can call database APIs without a stack overflow.
* [ ] Missing preload API still reports a clear error.
* [ ] Project build or type-check passes.

## Definition of Done

* Code changed only where needed.
* Lint/type-check/build verified where practical.
* Any newly discovered project convention worth preserving is captured in specs or explicitly judged unnecessary.

## Technical Approach

Update `src/renderer/services/DatabaseService.ts` so `GetApi()` stores `window.electronAPI` in a local variable, validates it, then returns it. Update `src/main/index.ts` to point BrowserWindow at `../preload/index.cjs`, which is the file emitted by the configured preload CommonJS build. Run the project verification command to catch TypeScript and bundling regressions.

## Decision (ADR-lite)

**Context**: The renderer depends on preload-injected IPC APIs. A recursive accessor crashes before any IPC call can succeed.

**Decision**: Fix the accessor directly instead of changing preload, IPC registration, or app shell behavior.

**Consequences**: This addresses the immediate white-screen root cause while keeping the Electron security model unchanged.

## Out of Scope

* Redesigning the app shell, navigation, or database layer.
* Changing IPC channel names.
* Adding new user-facing error screens beyond the existing ErrorBoundary.

## Technical Notes

* Relevant spec indexes: `.trellis/spec/frontend/index.md`, `.trellis/spec/backend/index.md`.
* Relevant files inspected: `electron.vite.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/services/DatabaseService.ts`.
* Dev failure log showed `Unable to load preload script: ... out\preload\index.js` and `ENOENT`, while `out/preload` contained `index.cjs`.
