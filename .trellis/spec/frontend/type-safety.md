# Type Safety

> Type safety patterns in this project.

---

## Overview

The project uses TypeScript 5.7 with `strict: true`. All types are defined as `interface` exports in `src/types/record.ts`. No runtime validation library (Zod, io-ts, etc.) is used.

## Type Organization

```
src/types/
└── record.ts    # MasturbationRecord, MasturbationStats
```

Types are imported directly by consumers:
```typescript
import { MasturbationRecord, MasturbationStats } from '../types/record';
```

## Key Type Definitions

```typescript
export interface MasturbationRecord {
    id: string;
    startTime: Date;      // NOTE: actually stores end time — misleading field name
    duration: number;     // minutes, 2 decimal places
    notes?: string;
}

export interface MasturbationStats {
    totalCount: number;
    averageDuration: number;
    frequencyPerWeek: number;
    frequencyPerMonth: number;
}
```

## Common Patterns

- **Optional properties** use `?` syntax (`notes?: string`)
- **No enums** — all discriminant values are string literals or numbers
- **No generics** — not needed at this scale
- **No type guards** — JSON parsing in `StorageService.getRecords()` uses `as any` cast with `.map()` rather than a type predicate

## Weak Points (from this codebase)

1. **No runtime validation on JSON parse** — `JSON.parse(data).map(...)` trusts localStorage data matches the interface
2. **`any` in storage service** — `StorageService.getRecords()` line 47: `(record: any)` cast
3. **`any` in event handler** — `handleStorageChange` receives `StorageEvent` but accesses `.key` without narrowing
4. **Date serialization** — `Date` objects are stored as ISO strings in JSON but reconstructed in `.map()` — a mismatch between the interface (`Date`) and the wire format (`string`) that TypeScript doesn't catch
5. **`@types/uuid` installed but unused** — `uuid` v11 ships its own types

## Rules for Rewrite

- Define types in `src/types/` unless they are component-local (inline interface above component)
- Prefer `interface` over `type` for object shapes
- Add runtime validation at the storage boundary (parse → validate → return)
- Fix the `startTime` naming to reflect actual semantics
