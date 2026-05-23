# Quality Guidelines

> Code quality standards for frontend development.

---

## Forbidden Patterns

1. **Don't duplicate data-fetching effect logic** between components — extract a shared hook
2. **Don't hardcode color values** (`'#2196f3'`) when an MUI theme token exists (`primary.main`)
3. **Don't use `any`** in type annotations — storage parsing should use explicit intermediate types (e.g., `RawRecord` with `string` dates before converting to `Date`)
4. **Don't send magic strings across components** — `'masturbation_record_updated'` should be a shared constant
5. **Don't leave dead code** — unused imports (`chart.js`, `react-chartjs-2`, `Button` in StatsChart.tsx) should be removed

## Required Patterns

1. **All side effects must be cleaned up** — intervals, event listeners, and timeouts must have corresponding cleanup in useEffect return
2. **Cross-component communication** goes through `localStorage` → `StorageService` → `CustomEvent` — never direct component refs
3. **Import order**: React → MUI → other third-party → project modules
4. **Named exports** for components and services (`export const X`), not default exports (except `App.tsx` per Vite convention)
5. **Renderer services must access IPC through `window.electronAPI`** — never import Electron APIs in renderer code and never call an accessor recursively

## Testing

Currently **no tests exist**. For the rewrite target:
- Minimum: unit tests for `StorageService` (pure logic, easy to test)
- Recommended: component smoke tests for RecordForm timer behavior

## Code Review Checklist

- [ ] No duplicate effect logic — shared hook if used in 2+ components
- [ ] No `any` types
- [ ] All intervals/listeners cleaned up
- [ ] Colors use theme tokens, not hardcoded hex
- [ ] No unused imports
- [ ] Event name from shared constant, not magic string

## Electron Preload API Access

### 1. Scope / Trigger

Use this pattern whenever renderer code needs data from the Electron main process. The renderer runs with `contextIsolation: true` and `nodeIntegration: false`, so all database access must go through the preload bridge.

### 2. Signatures

```typescript
function GetApi(): Window["electronAPI"]
```

### 3. Contracts

* `window.electronAPI` is injected by `src/preload/index.ts` via `contextBridge.exposeInMainWorld("electronAPI", electronAPI)`.
* Renderer services may call methods on `Window["electronAPI"]`.
* Renderer code must not import `ipcRenderer`, `electron`, or main-process database modules.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|-----------|-------------------|
| `window.electronAPI` exists | Return it and call IPC methods normally |
| `window.electronAPI` is `undefined` | Throw a clear preload/Electron environment error |
| Accessor calls itself | Bug: stack overflow or startup white screen |

### 5. Good/Base/Bad Cases

* Good: Electron app starts, preload exposes `electronAPI`, renderer service calls `GetApi().GetRecords()`.
* Base: Browser-only render fails with a clear "electronAPI is not available" error.
* Bad: `GetApi()` checks `GetApi() === undefined`, causing infinite recursion before IPC can run.

### 6. Tests Required

* Unit test the accessor when a test runner exists: define `window.electronAPI`, call the service method, assert the mock IPC method was used.
* Unit test the missing-preload case: delete or unset `window.electronAPI`, assert the clear environment error is thrown.
* Build/type-check must pass because preload declarations are included through `tsconfig.web.json`.

### 7. Wrong vs Correct

#### Wrong

```typescript
function GetApi(): Window["electronAPI"] {
    if (GetApi() === undefined) {
        throw new Error("electronAPI is not available");
    }
    return GetApi();
}
```

#### Correct

```typescript
function GetApi(): Window["electronAPI"] {
    const api: Window["electronAPI"] | undefined = window.electronAPI;

    if (api === undefined) {
        throw new Error("electronAPI is not available");
    }

    return api;
}
```
