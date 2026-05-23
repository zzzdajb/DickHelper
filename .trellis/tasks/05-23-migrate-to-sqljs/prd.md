# Migrate better-sqlite3 → sql.js

## Goal

Replace the native `better-sqlite3` C++ addon with `sql.js` (SQLite compiled to WASM) to eliminate native compilation failures on every `npm install`.

## What I already know

* Only **one source file** imports `better-sqlite3`: `src/main/database.ts`
* API surface used: `new Database(path)`, `.pragma()`, `.exec()`, `.prepare().get()`, `.prepare().all()`, `.prepare().run()`, `.close()`
* `sql.js` has near-identical API: `.prepare()`, `.get()`, `.all()`, `.run()`, `.exec()`, `.close()` — all synchronous after WASM init
* `electron.vite.config.ts` line 9 has `external: ["better-sqlite3"]` — must remove
* `package.json` has `postinstall: "electron-rebuild"` — no longer needed
* Data volume is tiny (< 1000 records), full-db export on every write is not a perf concern

## Key Design Difference

| | better-sqlite3 | sql.js |
|---|---|---|
| Persistence | File-backed, auto-committed to disk | In-memory; must `db.export()` + `fs.writeFileSync()` |
| Init | `new Database(path)` — sync | `await initSqlJs()` then `new SQL.Database(buffer)` — async |
| WAL | `.pragma("journal_mode = WAL")` | N/A (in-memory) |
| Statement lifecycle | Auto-cached by SQL string | New object each `.prepare()`; recommend `.free()` for memory |

## Requirements

### R1: Async database initialization
`DatabaseService` constructor cannot be sync anymore. Must `await initSqlJs()`, then load existing file buffer (if any) into `new SQL.Database(buffer)`.

### R2: Auto-save after writes
Every mutating operation (INSERT, DELETE, ClearAll) must call a private `_save()` helper that writes `this._db.export()` → `fs.writeFileSync(dbPath)`.

### R3: Zero API change for IPC layer
`src/main/index.ts` creates `new DatabaseService()` synchronously today. Must change to `await` init. All method signatures (`.GetRecords()`, `.SaveRecord()`, etc.) remain identical.

### R4: Remove native build tooling
- Remove `better-sqlite3` from dependencies
- Remove `@types/better-sqlite3` from devDependencies
- Remove `@electron/rebuild` from devDependencies
- Remove `"postinstall": "electron-rebuild"` from scripts
- Add `sql.js` to dependencies
- Add `@types/sql.js` to devDependencies (if not bundled with sql.js)
- Remove `external: ["better-sqlite3"]` from electron.vite.config.ts

### R5: Statement cleanup
Add `.free()` calls after statement use (or rely on GC — sql.js statements are JS objects that get GC'd, so for low-frequency use this is optional).

## Acceptance Criteria

* [ ] `npm install` passes without native compilation errors
* [ ] `npm run dev` starts the Electron app
* [ ] Existing database file is loaded correctly on startup
* [ ] Create/Read/Update/Delete records all work
* [ ] Database is persisted to disk after writes
* [ ] `npm run build` passes (type check)
* [ ] No `better-sqlite3` or `@electron/rebuild` in package.json

## Technical Approach

### database.ts changes

```typescript
import initSqlJs, { type Database, type Statement, type SqlJsStatic } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { randomUUID } from "node:crypto";

export class DatabaseService {
    private _db: Database;
    private readonly _dbPath: string;

    private constructor(db: Database, dbPath: string) {
        this._db = db;
        this._dbPath = dbPath;
    }

    // Async factory — replaces sync constructor
    public static async create(): Promise<DatabaseService> {
        const SQL: SqlJsStatic = await initSqlJs();
        const dbPath = path.join(app.getPath("userData"), "dickhelper.db");
        let db: Database;
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            db = new SQL.Database(buffer);
        } else {
            db = new SQL.Database();
        }
        db.exec(`CREATE TABLE IF NOT EXISTS Records (...)`);
        return new DatabaseService(db, dbPath);
    }

    private _save(): void {
        const data = this._db.export();
        fs.writeFileSync(this._dbPath, data);
    }

    // GetRecords, SaveRecord, DeleteRecord, etc. — same API, add this._save() after writes
}
```

### index.ts changes

```typescript
// Before:
const dbService = new DatabaseService();

// After:
const dbService = await DatabaseService.create();
```

### Files to modify

| File | Change |
|------|--------|
| `src/main/database.ts` | Rewrite — async factory, in-memory + export |
| `src/main/index.ts` | `await DatabaseService.create()` |
| `package.json` | Swap dependencies, remove electron-rebuild |
| `electron.vite.config.ts` | Remove `external: ["better-sqlite3"]` |

### Files NOT modified

* `src/preload/index.ts` — IPC bridge unchanged
* `src/preload/index.d.ts` — type declarations unchanged
* `src/renderer/services/DatabaseService.ts` — renderer wrapper unchanged
* All React components — unchanged
* `.github/workflows/*.yml` — unchanged

## Out of Scope

* Changing database schema or queries
* Adding transactions (not in current code, not adding now)
* Migrating existing data format (compatible — same SQLite file format)

## Risk: async init timing

The app startup currently creates DatabaseService synchronously before registering IPC handlers. With async init, `app.whenReady()` flow needs slight restructuring — but looking at `src/main/index.ts`, the database is created inside the `app.whenReady()` callback which is already async, so this is a minimal change.
