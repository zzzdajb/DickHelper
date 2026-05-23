# Directory Structure

> How Electron main process code is organized.

---

## Directory Layout

```
src/main/
├── index.ts        # App lifecycle: window creation, tray, IPC registration
└── database.ts     # SQLite connection, schema, CRUD, stats queries, import

src/preload/
├── index.ts        # contextBridge.exposeInMainWorld — whitelist IPC channels
└── index.d.ts      # Global Window.electronAPI type declarations
```

---

## Module Responsibilities

### `src/main/index.ts` — App Shell

- `app.whenReady()` entry point
- `BrowserWindow` creation (960x680, min 800x600, #f5f5f5 bg, ready-to-show)
- `Tray` setup (close-to-hide, right-click menu, double-click restore)
- `ipcMain.handle()` registration for all `records:*` channels
- Sends `records-updated` event to renderer after mutations
- `before-quit` cleanup (close database, destroy tray)

### `src/main/database.ts` — Data Layer

- `DatabaseService` class: single `better-sqlite3` connection
- Schema initialization (`CREATE TABLE IF NOT EXISTS`)
- All CRUD methods (GetRecords, SaveRecord, DeleteRecord, ClearAll)
- `GetStats()` — aggregation queries (COUNT, AVG with date filters)
- `GetDailyCounts()` — GROUP BY for heatmap data
- `ImportRecords()` — batch insert with validation + dedup
- `Close()` — clean connection shutdown

### `src/preload/index.ts` — Security Boundary

- `contextBridge.exposeInMainWorld("electronAPI", {...})`
- Each method wraps a single `ipcRenderer.invoke()` call
- `OnRecordsUpdated` wraps `ipcRenderer.on` + returns unsubscribe function
- No `nodeIntegration` — contextIsolation must be `true`

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| IPC channel | `domain:action` | `"records:get-all"`, `"records:save"` |
| Handler function | PascalCase | `RegisterIpcHandlers`, `CreateWindow` |
| Database class | PascalCase, `Service` suffix | `DatabaseService` |

---

## Rules

- Main process code lives in `src/main/` — no exceptions
- Preload code lives in `src/preload/` — no exceptions
- IPC channels follow `domain:action` naming (`records:*` for record CRUD)
- One class per file — `DatabaseService` handles all DB concerns, `index.ts` handles all app-lifecycle concerns
