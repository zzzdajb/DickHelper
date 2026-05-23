# Update GitHub Actions for Electron Build

## Goal

Remove old Docker publish workflow, replace with CI that builds Electron app for Windows/macOS/Linux on push to main and PRs.

## Requirements

- Remove `.github/workflows/docker-publish.yml` (Docker no longer relevant)
- Create `.github/workflows/ci.yml`:
  - Trigger: push to main, PR to main
  - Matrix: windows-latest, macos-latest, ubuntu-latest
  - Steps: checkout → setup Node 18 → npm ci → typecheck → electron-vite build
  - Upload build artifacts (`out/` directory)
- On version tags (`v*.*.*`), also package with electron-builder (if configured later)

## Acceptance Criteria

- [ ] Old Docker workflow removed
- [ ] New CI builds on all 3 platforms
- [ ] Typecheck passes
- [ ] Build artifacts uploaded for inspection

## Out of Scope

- electron-builder packaging (electron-builder not configured yet)
- Code signing (requires certificates/secrets)
- Auto-release to GitHub Releases
