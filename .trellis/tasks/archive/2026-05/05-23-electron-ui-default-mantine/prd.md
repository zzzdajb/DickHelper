# Improve Electron UI with beginner-friendly Mantine defaults

## Goal

Improve the existing Electron renderer UI so it feels more polished and modern while staying friendly to a frontend beginner. The work should rely mostly on Mantine's default components and props, avoid a custom design system, and leave the Error Page unchanged because it is a corner case.

## What I already know

* The app is an Electron + React + TypeScript renderer using Mantine 7 and Tabler icons.
* The current UI already has a sidebar AppShell, record view, statistics view, history view, and settings view.
* The desired direction is incremental polish using default Mantine styling, not a high-custom-CSS redesign.
* Error Page modernization is explicitly out of scope.
* Existing frontend specs prefer Mantine props, `Paper` cards, `Stack`/`Group` layout, named components, and no extra UI libraries.

## Assumptions

* Keep the current navigation model: a single `activeView` state, no React Router.
* Keep the current dependencies; do not introduce a charting library or CSS framework.
* Prefer changes that are easy for a frontend beginner to read and maintain.
* Keep existing behavior and data contracts unchanged.

## Requirements

* Use the lightweight structure optimization approach: improve view structure and component props without introducing new shared abstractions unless a small local helper already exists or is clearly simpler.
* Add a consistent page structure across normal views: title, optional muted subtitle, and clear content sections.
* Improve the record page with clearer recording state display and better button hierarchy while using Mantine defaults.
* Improve the history view's scanability without introducing complex custom layouts.
* Improve the statistics view with clearer stat cards, default icons, helper copy, and better empty/zero-state handling where useful.
* Keep settings page simple, but make its sections visually consistent with the rest of the app.
* Avoid rewriting the Error Page.
* Avoid heavy visual customization such as custom CSS modules, animations, glass effects, custom title bars, or large theme overrides.

## Acceptance Criteria

* [ ] Normal pages use consistent spacing and heading patterns.
* [ ] Record view communicates `not started`, `recording`, and `paused` states clearly.
* [ ] Primary, secondary, and destructive actions are visually distinguishable using Mantine variants/colors.
* [ ] History records are easier to scan, with date, duration, notes, and delete action clearly separated.
* [ ] Statistics cards include clearer labels and visual affordances without adding new dependencies.
* [ ] Settings remains functionally unchanged and visually consistent.
* [ ] ErrorBoundary/Error Page code remains unchanged except for incidental import ordering only if unavoidable.
* [ ] Build/type-check passes.

## Definition of Done

* TypeScript build/type-check passes.
* Existing user flows still work: start/pause/resume/stop record, delete/clear history, import/export data, view stats.
* No new dependencies are added.
* UI remains Mantine-default-oriented and easy to maintain.

## Out of Scope

* Error Page redesign.
* New routes, React Router, or navigation architecture changes.
* Custom design system, CSS modules, Tailwind, styled-components, or large theme token overhaul.
* New analytics/charting library.
* Database, IPC, preload, or main-process behavior changes unless required to fix a UI regression.

## Technical Notes

* Likely files: `src/renderer/App.tsx`, `src/renderer/views/RecordForm.tsx`, `src/renderer/views/HistoryList.tsx`, `src/renderer/views/StatsChart.tsx`, `src/renderer/views/Settings.tsx`.
* Relevant specs: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/app-shell.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/frontend/type-safety.md`, `.trellis/spec/frontend/code-style.md`.
* Current AppShell already follows the intended no-router architecture.
* Current UI uses Mantine components but has inconsistent view-level structure and limited state hierarchy.

## Decision

Choose lightweight structure optimization. This keeps the work beginner-friendly: mostly Mantine props, clear JSX layout, and local view-level refinements. Avoid medium component extraction and larger visual/theme changes for this task.
