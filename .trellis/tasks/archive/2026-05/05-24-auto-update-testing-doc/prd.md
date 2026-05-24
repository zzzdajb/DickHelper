# Auto Update Testing Documentation

## Goal

Add a short developer-facing document that explains how to test the Electron auto-update flow safely before publishing a real user-facing release.

## Requirements

* Document the recommended manual test flow for auto-update.
* Cover version/tag expectations: GitHub tag uses `vX.Y.Z`, while `package.json.version` uses `X.Y.Z`.
* Explain what Release assets must exist for the updater metadata to work.
* Include guidance for testing both the default `ghfast.top` mirror source and GitHub direct source.
* Link the new document from the README auto-update section.

## Acceptance Criteria

* [x] A concise auto-update testing document exists under `docs/`.
* [x] The document describes how to test from an older installed version to a newer release.
* [x] The document mentions update metadata files and artifact filename consistency.
* [x] README points readers to the detailed testing document.

## Definition of Done

* Documentation is clear enough for a maintainer to follow without reading implementation code.
* No code behavior changes are included in this task.
* Markdown links are valid.

## Technical Approach

Create `docs/auto-update-testing.md` in the same style as the existing migration guide, then add a short link from `README.md`.

## Out of Scope

* Changing the updater implementation.
* Changing the GitHub Actions release workflow.
* Adding automated tests for updater behavior.

## Technical Notes

* Existing README already documents release version rules and high-level auto-update behavior.
* `.trellis/spec/backend/ci-github-actions.md` records the release asset and updater metadata contract.
