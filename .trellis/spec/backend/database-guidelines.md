# Database Guidelines

> SQLite via sql.js (WASM) — patterns, conventions, and gotchas.

---

## Overview

The Electron main process holds a single SQLite database connection via `sql.js` (WASM-compiled SQLite). The database file lives in `app.getPath("userData")/dickhelper.db`. Renderer processes access data exclusively through IPC (no direct DB access).

- **Library**: `sql.js` (async init, synchronous queries after init — WASM, no native compilation)
- **Location**: `src/main/database.ts` — all queries in one `DatabaseService` class
- **Access pattern**: Renderer → IPC invoke → Main handler → DatabaseService method → SQLite

---

## Setup Pattern (Async Factory)

sql.js requires async initialization (WASM loading). Use a static async factory instead of a sync constructor:

```typescript
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export class DatabaseService {
    private readonly _db: Database;
    private readonly _dbPath: string;

    private constructor(db: Database, dbPath: string) {
        this._db = db;
        this._dbPath = dbPath;
    }

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
        db.run(`CREATE TABLE IF NOT EXISTS Records (...)`);
        return new DatabaseService(db, dbPath);
    }
}
```

**Why async factory**: `initSqlJs()` loads the WASM binary asynchronously. The constructor must be private — callers use `await DatabaseService.create()`.

### Persistence

sql.js keeps the entire database in memory. After every mutation, export and write to disk:

```typescript
private _save(): void {
    const data = this._db.export();
    fs.writeFileSync(this._dbPath, data);
}
```

**No WAL mode**: sql.js (WASM) does not support WAL journal mode. The in-memory + periodic write model is the persistence strategy.

---

## Caller Pattern

Callers must `await DatabaseService.create()` — sync `new DatabaseService()` will not work:

```typescript
// In src/main/index.ts
app.whenReady().then(async () => {
    databaseService = await DatabaseService.create();
    RegisterIpcHandlers();
    CreateWindow();
});
```

---

## Schema

```sql
CREATE TABLE IF NOT EXISTS Records (
    Id        TEXT PRIMARY KEY,  -- UUID v4 (crypto.randomUUID())
    StartTime TEXT NOT NULL,     -- ISO 8601 UTC
    EndTime   TEXT NOT NULL,     -- ISO 8601 UTC
    Duration  REAL NOT NULL,     -- minutes
    Notes     TEXT               -- nullable
);
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Table name | PascalCase | `Records` |
| Column name | PascalCase | `Id`, `EndTime` |
| Primary key | `Id` (TEXT, UUID) | — |
| Dates | ISO 8601 UTC TEXT | `"2026-05-23T10:30:00.000Z"` |
| Nullable columns | No special naming | `Notes TEXT` (no `NOT NULL`) |

---

## Query Patterns

### Helper Methods (Required)

sql.js uses a C-style statement API: `prepare()` → `bind()` → `step()` → `getAsObject()` → `free()`. Wrap this in helper methods:

```typescript
private _queryAll(sql: string, params?: BindParams): ParamsObject[] {
    const stmt = this._db.prepare(sql);
    if (params !== undefined) stmt.bind(params);
    const rows: ParamsObject[] = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

private _queryOne(sql: string, params?: BindParams): ParamsObject | undefined {
    const stmt = this._db.prepare(sql);
    if (params !== undefined) stmt.bind(params);
    let row: ParamsObject | undefined;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}
```

**Always `free()` statements** after use. sql.js does not auto-close statements.

### SELECT queries

```typescript
// Multiple rows
const rows = this._queryAll("SELECT Id, EndTime, Duration FROM Records ORDER BY EndTime DESC");
return rows as unknown as IDbRecord[];

// Single row
const row = this._queryOne("SELECT COUNT(*) as count FROM Records WHERE EndTime >= ?", [isoString]);
return (row?.count as number) ?? 0;
```

### INSERT / UPDATE / DELETE

Use `stmt.run([...params])` for mutations, then check `getRowsModified()`:

```typescript
public DeleteRecord(id: string): boolean {
    const stmt = this._db.prepare("DELETE FROM Records WHERE Id = ?");
    stmt.run([id]);
    const changes = this._db.getRowsModified();
    stmt.free();
    this._save();
    return changes > 0;
}
```

**`getRowsModified()`** is the sql.js equivalent of better-sqlite3's `.run().changes`.

### Batch Import

```typescript
public ImportRecords(records: IImportRecord[]): IImportResult {
    const stmt = this._db.prepare(
        "INSERT INTO Records (Id, StartTime, EndTime, Duration, Notes) VALUES (?, ?, ?, ?, ?)"
    );
    for (const record of records) {
        if (!record.Id || typeof record.Duration !== "number") { rejected++; continue; }
        if (this.RecordExists(record.Id)) continue;  // dedup
        stmt.bind([record.Id, startTime, endTime, record.Duration, record.Notes ?? null]);
        stmt.step();
        stmt.reset();  // reset for next bind
    }
    stmt.free();
    this._save();
    return { Imported, Skipped, Rejected };
}
```

**Call `stmt.reset()` between iterations** when reusing a prepared statement with `bind()` + `step()` in a loop.

---

## Date & Timezone Handling

### The Problem

SQLite's `date(EndTime)` extracts the **UTC** date from ISO 8601 timestamps. JavaScript's `Date.toISOString().slice(0, 10)` also produces a **UTC** date. But heatmap cells represent **local** calendar days. For any non-UTC timezone, the two dates diverge.

### The Fix: JS-Side Local Date Grouping

Do NOT use `date(EndTime)` in SQL for grouping. Instead, query raw timestamps and group by local date in JavaScript:

```typescript
public GetDailyCounts(startTimestamp: number, endTimestamp: number): IDailyCount[] {
    const rows = this._queryAll(
        "SELECT EndTime FROM Records WHERE EndTime >= ? AND EndTime <= ?",
        [new Date(startTimestamp).toISOString(), new Date(endTimestamp).toISOString()]
    );

    const countMap = new Map<string, number>();
    for (const row of rows) {
        const d = new Date((row as { EndTime: string }).EndTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    // sort and return IDailyCount[]
}
```

### IPC Contract: Timestamps, Not Date Strings

The IPC handler passes numeric timestamps (milliseconds since epoch), not pre-formatted date strings:

```typescript
// IPC handler (main/index.ts)
ipcMain.handle("records:get-daily-counts", (...args) => {
    const startTimestamp: number = args[1] as number;
    const endTimestamp: number = args[2] as number;
    return databaseService!.GetDailyCounts(startTimestamp, endTimestamp);
});

// Renderer (DatabaseService.ts)
public static async GetDailyCounts(startDate: Date, endDate: Date): Promise<IDailyCount[]> {
    return GetApi().GetDailyCounts(startDate.getTime(), endDate.getTime());
}

// Heatmap cell key (StatsChart.tsx) — use local date, NOT toISOString
const y = cellDate.getFullYear();
const m = String(cellDate.getMonth() + 1).padStart(2, "0");
const d = String(cellDate.getDate()).padStart(2, "0");
const dateKey = `${y}-${m}-${d}`;
```

**Why timestamps**: They are timezone-agnostic. Both sides convert to/from local dates using the same `new Date()` constructor, ensuring consistent local date grouping.

### Heatmap Data Flow (End to End)

```
StatsChart.LoadData()
  ├─ startDate/now: local Date objects (midnight / 23:59:59.999)
  ├─ GetDailyCounts(startDate, now) → .getTime() → IPC → GetDailyCounts(ts, ts)
  │   └─ SQL: WHERE EndTime >= ? AND EndTime <= ? (ISO comparison)
  │   └─ JS: group by `${getFullYear()}-${getMonth()+1}-${getDate()}`
  │   └─ Returns: [{ Date: "2026-05-23", Count: 3 }, ...]
  └─ GenerateHeatmapData()
      └─ cell key: `${getFullYear()}-${getMonth()+1}-${getDate()}`
      └─ Lookup: dailyCounts.get(dateKey) — keys now match
```

---

## Common Mistakes

1. **Using `date(EndTime)` for local-date grouping** — SQLite's `date()` extracts UTC date. For heatmap display, always group by local date in JS using `new Date()`.
2. **Using `toISOString().slice(0, 10)` for heatmap keys** — This is the UTC date of local midnight. For heatmap cells representing local calendar days, use `getFullYear()/getMonth()/getDate()` instead.
3. **Forgetting `stmt.free()`** — sql.js does not auto-close prepared statements. Leaked statements waste WASM memory.
4. **Forgetting `stmt.reset()` in loops** — When reusing a prepared statement with `bind()` + `step()` in a loop, call `stmt.reset()` before the next `bind()`, or use `stmt.run([...params])` which resets automatically.
5. **Forgetting `this._save()` after mutations** — sql.js keeps data in memory; changes are lost on app close without explicit `export()` + `writeFileSync()`.
6. **Using `stmt.run().changes`** — sql.js has no return value from `run()`. Use `this._db.getRowsModified()` after the statement executes.
7. **Sync constructor** — `new DatabaseService()` won't work. Always use `await DatabaseService.create()`.
