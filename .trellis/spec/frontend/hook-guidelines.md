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

Thin React adapter over the timer bookkeeping in `packages/core/src/timer`. The hook owns only React state, the 1-second tick, and (on mobile) screen keep-awake — **it must not compute durations itself**.

`src/renderer/hooks/useTimer.ts` and `apps/mobile/src/hooks/useTimer.ts` both implement the **single** `IUseTimerResult` declared in `packages/core/src/timer/timer.types.ts` and re-exported from `@dickhelper/core`. Neither hook declares its own copy, so the contract needs **no manual mirroring** — if one side drops or renames a member, `typecheck` fails on that side.

`IUseTimerResult` lives in `packages/core`, not `packages/shared`, because it references `ITimerSession`: `packages/core` depends on `packages/shared`, so moving the contract to `shared` would create a `shared ↔ core` cycle. The type contains only booleans, numbers, and function signatures — no React dependency, so it does not compromise `core`'s purity.

```typescript
import { useTimer } from "../hooks/useTimer";

const { IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop, Cancel } = useTimer();

// Start(): void — begin timing (clears any leftover interval first)
// Pause(): void — pause (no-op if not recording or already paused)
// Resume(): void — resume after pause (no-op if not paused)
// Stop(): ITimerSession | null — null when never started; { StartTime, EndTime, DurationMinutes }
// Cancel(): void — discard this session, no result returned, safe no-op when not recording
```

**Return naming**: PascalCase because these are public API surface (C# convention). The hook is a factory that returns an object with control methods and state values.

**Bookkeeping lives in `@dickhelper/core`** — `IDLE_TIMER_STATE`, `StartTimer`, `PauseTimer`, `ResumeTimer`, `StopTimer`, `GetTimerElapsedSeconds`, `IsTimerRunning`, `IsTimerPaused`, plus the types `ITimerState`, `ITimerSession`, `IUseTimerResult`. Those are pure functions over an immutable `ITimerState`; "now" is always passed in as `nowMs`, so the whole layer is unit-testable without fake clocks (`packages/core/test/timer.test.ts`).

**Internals** (not exposed):
- `timerState: ITimerState` — state used for rendering
- `timerStateRef: ITimerState` — mirror of the above so the tick and the button callbacks read the latest value
- `intervalRef` — setInterval handle for the 1-second tick

**Cleanup**: `Stop` and `Cancel` share one `ResetTimerState()` path (clears interval, resets state, zeroes `ElapsedSeconds`, releases keep-awake on mobile). `StopTimer` is pure and clears nothing, so this path is the adapter's responsibility. The unmount `useEffect` uses an **empty** dependency array with inlined cleanup — a dependency there would re-run cleanup on every render and kill the interval / keep-awake mid-session.

---

## Hook Rules

1. Only use hooks at the top level of components — no conditional hooks
2. Cleanup all intervals, event listeners, and subscriptions in useEffect return
3. Do not use `useMemo` / `useCallback` unless a performance issue is measured and proven
4. Return values are PascalCase throughout — **both** state flags and methods (matching the C# convention where `Start` / `Stop` are method names). The previous wording of this rule said "camelCase for functions", which contradicted both its own parenthetical and the `useTimer` example above it; PascalCase is the rule. This applies to `apps/mobile` hooks as well, not just the desktop renderer.
5. One hook per concern — don't combine timer logic with data fetching

---

## Removed from Old Version

The following old patterns are gone:
- **Duplicate `useEffect` blocks** in StatsChart and HistoryList — extracted into `useRecords`
- **`setInterval(updateData, 60000)`** polling — replaced by IPC push notifications
- **`window.addEventListener('masturbation_record_updated')`** — replaced by IPC event subscription in `useRecords`
- **`window.addEventListener('storage')`** — irrelevant in Electron
