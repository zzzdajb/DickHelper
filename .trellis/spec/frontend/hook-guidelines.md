# Hook Guidelines

> How custom React hooks are built and used.

---

## Available Hooks

### `useRecords` — Record Data

Loads records from SQLite on mount, auto-refreshes on IPC `records-updated` event.

```typescript
import { useRecords } from "../hooks/useRecords";

const { records, loading, refresh } = useRecords();
// records: IRecord[] — sorted by EndTime DESC (newest first)
// loading: boolean — true during initial fetch
// refresh: () => void — manual refresh (rarely needed — IPC event handles auto-refresh)
```

**Behavior**:
- Fetches all records on mount via `DatabaseService.GetRecords()`
- Subscribes to `records-updated` IPC event → auto-refresh
- Unsubscribes on unmount (useEffect cleanup)
- No polling — push-based updates from main process

### `useTimer` — Timer Logic

Encapsulates the timer state machine (start/pause/resume/stop). Uses `useRef` for mutable values that shouldn't trigger re-renders.

```typescript
import { useTimer } from "../hooks/useTimer";

const { IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop } = useTimer();

// Start(): void — begin timing
// Pause(): void — pause (no-op if not recording or already paused)
// Resume(): void — resume after pause (no-op if not paused)
// Stop(): { startTime: Date; endTime: Date; durationMinutes: number } | null
```

**Return naming**: PascalCase because these are public API surface (C# convention). The hook is a factory that returns an object with control methods and state values.

**Internal refs** (not exposed):
- `startTimeRef: Date | null`
- `accumulatedPauseRef: number` — total pause time in milliseconds
- `lastPauseTimeRef: Date | null` — when current pause started
- `intervalRef` — setInterval handle for 1-second tick

**Cleanup**: Clears interval on Stop and on unmount (useEffect return).

---

## Hook Rules

1. Only use hooks at the top level of components — no conditional hooks
2. Cleanup all intervals, event listeners, and subscriptions in useEffect return
3. Do not use `useMemo` / `useCallback` unless a performance issue is measured and proven
4. Return values are PascalCase for state flags, camelCase for functions (matching the C# convention of `Start`/`Stop` being method names)
5. One hook per concern — don't combine timer logic with data fetching

---

## Removed from Old Version

The following old patterns are gone:
- **Duplicate `useEffect` blocks** in StatsChart and HistoryList — extracted into `useRecords`
- **`setInterval(updateData, 60000)`** polling — replaced by IPC push notifications
- **`window.addEventListener('masturbation_record_updated')`** — replaced by IPC event subscription in `useRecords`
- **`window.addEventListener('storage')`** — irrelevant in Electron
