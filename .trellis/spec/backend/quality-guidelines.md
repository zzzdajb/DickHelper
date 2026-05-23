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
