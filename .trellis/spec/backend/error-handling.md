# Error Handling

> How errors are handled in the Electron main process and IPC layer.

---

## Overview

The main process handles errors at two boundaries:
1. **Database layer** — better-sqlite3 throws synchronous exceptions on query failure
2. **IPC layer** — `ipcMain.handle()` wraps database calls; unhandled rejections propagate to renderer

There is no custom error class hierarchy. Errors at the IPC boundary are caught and returned as structured results (for operations that can fail gracefully, like import).

---

## IPC Error Propagation

`ipcMain.handle()` automatically propagates thrown errors to the renderer as rejected promises:

```typescript
// Main process — if SaveRecord throws, renderer's await rejects
ipcMain.handle("records:save", (_event, startTime, endTime, duration, notes) => {
    return databaseService!.SaveRecord(new Date(startTime), new Date(endTime), duration, notes);
});

// Renderer — caller handles rejection
try {
    await window.electronAPI.SaveRecord(...);
} catch {
    // Handle failure
}
```

---

## Graceful Failure: Import

Import operations return a result object instead of throwing — because partial failure is expected (invalid records, duplicates):

```typescript
interface IImportResult {
    readonly Imported: number;
    readonly Skipped: number;
    readonly Rejected: number;
}
```

Invalid records are counted and skipped. Valid records are inserted. The caller decides how to present the result to the user.

---

## Patterns

### Validation at the boundary

```typescript
// DatabaseService.ImportRecords — validate before touching SQLite
if (!record.Id || typeof record.Id !== "string") { rejected++; continue; }
if (typeof record.Duration !== "number" || record.Duration < 0) { rejected++; continue; }
const endDate = new Date(endTimeStr);
if (isNaN(endDate.getTime())) { rejected++; continue; }
```

### Parse failure at the service layer

```typescript
// DatabaseService.ImportFromJson — catch JSON parse errors
try {
    rawData = JSON.parse(jsonText);
} catch {
    return { Imported: 0, Skipped: 0, Rejected: 0 };
}
```

---

## What NOT to Do

- **Don't wrap every database call in try/catch** — let errors propagate to IPC. The renderer handles user-visible error states.
- **Don't swallow errors silently** — if a mutation fails, the user must know.
- **Don't return `null` for errors** — use structured result objects (`IImportResult`) for partial-failure cases, or let exceptions propagate for hard failures.
