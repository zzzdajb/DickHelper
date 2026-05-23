# Quality Guidelines

> Code quality standards for Electron main process code.

---

## Forbidden Patterns

1. **Don't expose `ipcRenderer` directly** — all IPC goes through `contextBridge.exposeInMainWorld`. The `nodeIntegration: false` + `contextIsolation: true` pair is mandatory.
2. **Don't use template literals for SQL** — always use `?` placeholders with prepared statements.
3. **Don't access the database from the renderer process** — all data access goes through IPC.
4. **Don't use `any` in IPC payloads** — main process handlers should use explicit parameter types.
5. **Don't leave database connections open on quit** — `app.on("before-quit")` must call `databaseService.Close()`.

## Required Patterns

1. **Use `ipcMain.handle` / `ipcRenderer.invoke`** (not `on`/`send`) for request-response IPC.
2. **Send `records-updated` event after every mutation** — renderer needs to know when data changes.
3. **Use `better-sqlite3` synchronously** — no need for async wrappers around a synchronous API.
4. **Wrap date columns with `date()` in WHERE clauses** when comparing against date-only strings.
5. **Use `app.getPath("userData")` for the database file** — never hardcode paths.
6. **Set `backgroundColor: "#f5f5f5"` on BrowserWindow** — prevents white flash before React renders.
7. **Use `show: false` + `ready-to-show`** — show window only after content is painted.
8. **Keep BrowserWindow preload path aligned with the build output** — if preload is emitted as CommonJS (`index.cjs`), load `../preload/index.cjs`, not `index.js`.

## IPC Channel Naming

All record-related IPC channels follow `records:<action>` pattern:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `records:get-all` | invoke | Fetch all records |
| `records:save` | invoke | Insert new record |
| `records:delete` | invoke | Delete one record by ID |
| `records:clear-all` | invoke | Delete all records |
| `records:get-stats` | invoke | Fetch statistics aggregation |
| `records:get-daily-counts` | invoke | Fetch per-day counts for heatmap |
| `records:import` | invoke | Batch import with dedup |
| `records-updated` | event (main→renderer) | Notify renderer data changed |

## Testing

Currently no tests exist. Minimum recommended:
- Unit tests for `DatabaseService` methods (in-memory SQLite for test isolation)
- Smoke tests for IPC handler registration

## BrowserWindow Preload Path

### 1. Scope / Trigger

Check this whenever `electron.vite.config.ts` changes preload output format or `src/main/index.ts` changes `webPreferences.preload`.

### 2. Signatures

```typescript
const preloadPath: string = path.join(__dirname, "../preload/index.cjs");
```

### 3. Contracts

* `src/preload/index.ts` is built into `out/preload/`.
* Current preload Rollup output format is CommonJS, so the emitted file is `out/preload/index.cjs`.
* `BrowserWindow.webPreferences.preload` must point to the emitted preload file exactly.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|-----------|-------------------|
| Preload path matches emitted file | Electron loads preload and `window.electronAPI` is available |
| Preload path uses stale extension | Electron logs `Unable to load preload script` with `ENOENT` |
| Preload does not load | Renderer data access fails because `window.electronAPI` is undefined |

### 5. Good/Base/Bad Cases

* Good: `out/preload/index.cjs` exists and main process logs that exact preload path.
* Base: Production build creates `out/preload/index.cjs` and renderer still starts from `out/renderer/index.html`.
* Bad: Main process loads `out/preload/index.js` while the build emits only `index.cjs`.

### 6. Tests Required

* After changing preload output or path, run `npm run build` and confirm `out/preload/index.cjs` exists.
* Run `npm run dev` long enough to confirm there is no `Unable to load preload script` log.
* Confirm renderer logs include preload success or the first view can call IPC without `electronAPI is not available`.

### 7. Wrong vs Correct

#### Wrong

```typescript
const preloadPath: string = path.join(__dirname, "../preload/index.js");
```

#### Correct

```typescript
const preloadPath: string = path.join(__dirname, "../preload/index.cjs");
```
