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
