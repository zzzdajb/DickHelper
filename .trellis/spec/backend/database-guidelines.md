# Database Guidelines

> SQLite via better-sqlite3 — patterns, conventions, and gotchas.

---

## Overview

The Electron main process holds a single SQLite database connection via `better-sqlite3`. The database file lives in `app.getPath("userData")/dickhelper.db`. Renderer processes access data exclusively through IPC (no direct DB access).

- **Library**: `better-sqlite3` (synchronous API — no async overhead for local SQLite)
- **Location**: `src/main/database.ts` — all queries in one `DatabaseService` class
- **Access pattern**: Renderer → IPC invoke → Main handler → DatabaseService method → SQLite

---

## Setup Pattern

```typescript
import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";

export class DatabaseService {
    private readonly _db: Database.Database;

    public constructor() {
        const dbPath: string = path.join(app.getPath("userData"), "dickhelper.db");
        this._db = new Database(dbPath);
        this._db.pragma("journal_mode = WAL");
        this.InitializeSchema();
    }
}
```

**Why WAL mode**: Allows concurrent reads while writing, and Electron's single-process model means only one connection exists — but WAL still improves read performance and crash safety.

---

## Schema

```sql
CREATE TABLE IF NOT EXISTS Records (
    Id        TEXT PRIMARY KEY,  -- UUID v4 (crypto.randomUUID())
    StartTime TEXT NOT NULL,     -- ISO 8601
    EndTime   TEXT NOT NULL,     -- ISO 8601
    Duration  REAL NOT NULL,     -- minutes, 2 decimal places
    Notes     TEXT               -- nullable
);
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Table name | PascalCase | `Records` |
| Column name | PascalCase | `Id`, `EndTime` |
| Primary key | `Id` (TEXT, UUID) | — |
| Dates | ISO 8601 TEXT | `"2026-05-23T10:30:00.000Z"` |
| Nullable columns | No special naming | `Notes TEXT` (no `NOT NULL`) |

---

## Query Patterns

### Prepared Statements (ALWAYS)

```typescript
// Correct: prepared statement
public GetRecords(): IDbRecord[] {
    const stmt = this._db.prepare("SELECT Id, StartTime, EndTime, Duration, Notes FROM Records ORDER BY EndTime DESC");
    return stmt.all() as IDbRecord[];
}

// Correct: parameterized
public DeleteRecord(id: string): boolean {
    const result = this._db.prepare("DELETE FROM Records WHERE Id = ?").run(id);
    return result.changes > 0;
}
```

**Never use template literals for SQL values** — always `?` placeholders with `.run(params)` or `.get(params)`.

### Stats in SQL (Not JS)

Statistical calculations are pushed to SQL, not computed in JavaScript by iterating arrays:

```typescript
// Correct: SQL aggregation
const totalRow = this._db
    .prepare("SELECT COUNT(*) as count, AVG(Duration) as avgDur FROM Records")
    .get();

// Correct: filtered aggregation
const weekRow = this._db
    .prepare("SELECT COUNT(*) as count FROM Records WHERE date(EndTime) >= ?")
    .get(oneWeekAgo.toISOString().slice(0, 10));
```

### Date Comparison Gotcha

**SQLite stores dates as TEXT (ISO 8601). String comparison on full ISO timestamps breaks date-only comparisons.**

```sql
-- Wrong: "2026-05-23T10:30:00.000Z" <= "2026-05-23" is FALSE in SQLite
SELECT COUNT(*) FROM Records WHERE EndTime <= '2026-05-23';  -- misses today!

-- Correct: use date() function to extract date portion
SELECT COUNT(*) FROM Records WHERE date(EndTime) <= '2026-05-23';
```

**Rule**: Always wrap `EndTime`/`StartTime` columns with `date()` when comparing against date-only strings (e.g., from `.slice(0, 10)`). This bug was caught in review and is a classic SQLite TEXT date pitfall.

### Batch Import with Dedup

```typescript
public ImportRecords(records: IImportRecord[]): IImportResult {
    const insertStmt = this._db.prepare(
        "INSERT INTO Records (Id, StartTime, EndTime, Duration, Notes) VALUES (?, ?, ?, ?, ?)"
    );

    for (const record of records) {
        // Validate required fields first
        if (!record.Id || typeof record.Id !== "string") { rejected++; continue; }
        if (typeof record.Duration !== "number" || record.Duration < 0) { rejected++; continue; }

        // Dedup: skip existing UUIDs
        if (this.RecordExists(record.Id)) continue;

        insertStmt.run(record.Id, startTime, endTime, record.Duration, record.Notes ?? null);
    }
    return { Imported, Skipped, Rejected };
}
```

---

## Common Mistakes

1. **Forgetting `date()` in WHERE clauses** — comparing full ISO strings against date-only strings silently excludes data. Always use `date(column)` when the parameter is a date-only string.
2. **Not using prepared statements** — raw string interpolation is forbidden even in internal code. SQL injection through internal data is still a bug.
3. **SQLite type coercion surprises** — `REAL` columns accept integers silently. `TEXT` columns accept numbers silently. Validate types at the service layer before passing to SQLite.
