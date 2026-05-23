# State Management

> How state is managed in the Electron renderer process.

---

## Overview

All persistent state lives in SQLite (main process). React component state (`useState`) is the only state management mechanism — no Redux, Zustand, or Context. Data flows through IPC:

```
Renderer (React)  →  IPC (invoke)  →  Main Process  →  SQLite (better-sqlite3)
```

---

## State Categories

### Persistent State (SQLite)

| Table | Schema | Reader | Writer |
|-------|--------|--------|--------|
| `Records` | Id, StartTime, EndTime, Duration, Notes | DatabaseService.GetRecords() | DatabaseService.SaveRecord() / DeleteRecord() / ClearAll() |

### Component State (useState)

| Component | States |
|-----------|--------|
| App | `activeView: View` ("record" \| "stats" \| "history" \| "settings") |
| RecordForm | `notes: string`, `importMessage: string \| null` |
| StatsChart | `stats: IStats`, `dailyCounts: Map<string, number>` |
| HistoryList | `deleteModalOpen: boolean` |

### Hook State

| Hook | States | Returned |
|------|--------|----------|
| useRecords | `records: IRecord[]`, `loading: boolean` | `{ records, loading, refresh }` |
| useTimer | `isRecording`, `isPaused`, `elapsedSeconds` (via useRef for timers) | `{ IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop }` |

---

## Cross-Component Sync

Components synchronize via a single IPC event:

```
RecordForm (write)
  → DatabaseService.SaveRecord()
    → window.electronAPI.SaveRecord() (IPC invoke)
      → main process: INSERT INTO Records
        → mainWindow.webContents.send("records-updated")
          → preload: ipcRenderer.on("records-updated")
            → useRecords hook: refresh() called automatically

StatsChart / HistoryList (read)
  → useRecords hook: loads on mount, re-loads on "records-updated" event
```

No polling (no `setInterval`). No CustomEvent. No localStorage `storage` event. A single IPC event from main process drives all UI updates.

---

## Timer State (Non-Persistent)

Timer state (`isRecording`, `isPaused`, `elapsedSeconds`) is intentionally **not persisted**. If the user closes the app or refreshes during a recording session, the timer resets — same behavior as the old version. This is acceptable because:
1. Timer sessions are typically short (< 1 hour)
2. Persisting partial timer state adds complexity without proportional value

---

## Removed from Old Version

The following old-web state patterns are gone:

- **localStorage** — replaced by SQLite. No `localStorage.getItem/setItem`.
- **CustomEvent('masturbation_record_updated')** — replaced by IPC `records-updated` event.
- **`storage` event for cross-tab sync** — irrelevant in Electron (single window).
- **`setInterval(updateData, 60000)` polling** — replaced by push-based IPC notification.
- **Duplicate data-fetching in every component** — extracted into `useRecords` hook, shared by all views.
