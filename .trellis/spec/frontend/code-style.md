# Code Style — C# / .NET Style TypeScript

> All TypeScript code must follow C# conventions unless React framework rules force otherwise.

---

## Naming

| Item | Convention | Example |
|------|-----------|---------|
| Class / Interface | PascalCase, `I` prefix for interface | `class StorageService`, `interface IRecord` |
| Public method / property | PascalCase | `public GetRecords(): IRecord[]` |
| Private field | `_camelCase` prefix | `private readonly _dbPath: string;` |
| Local variable | camelCase | `const record = ...` |
| Event handler | PascalCase, `Handle` prefix | `HandleClick`, `HandleSubmit` |
| React component | PascalCase | `export const RecordForm = () =>` |

## Must

- Use `class` for services and data model, `interface` for contracts
- Explicit `public` / `private` on all members
- Explicit return type on all methods
- Use `readonly` for fields set only in constructor
- `for...of` for iteration over `reduce`
- Break complex logic into named `private` methods
- Arrow functions **only** for React hook callbacks and JSX event props — business logic uses named methods
- One class/interface per file

## Avoid

- `any` — use `unknown` + type guards when handling untyped data (e.g. JSON parse results)
- `reduce` — use `for...of` or named aggregation methods
- Long arrow function chains spanning multiple lines
- Inline anonymous functions for non-trivial logic

## Forbidden

- Inheritance deeper than 1 level
- DI containers (Awilix, Inversify, etc.)
- Abstract factories / factory patterns
- Unnecessary generics
- "Pattern show-off" — if a pattern doesn't solve a concrete problem, don't use it

## Beginner-Friendly Code (CRITICAL)

The author is a frontend beginner. Code must be readable by someone new to React/TypeScript.

- **Three similar lines > one premature abstraction.** Don't extract a helper until the pattern repeats 3+ times and the abstraction is simpler than the duplication.
- **Over-decoupling is worse than tight coupling.** A single file with 200 straightforward lines beats 5 files with 40 lines each connected through interfaces.
- **Don't add features, refactors, or abstractions beyond what the task requires.** A bug fix doesn't need surrounding cleanup. A one-shot operation doesn't need a helper.
- **No half-finished implementations.** Either do it or don't.
- **Don't design for hypothetical future requirements.** Solve today's problem today.
- **Error handling only at system boundaries.** Trust internal code and framework guarantees. Don't wrap every function in try/catch.
- **Validation only at system boundaries.** Validate user input and external data. Trust your own code.
- **Flat is better than nested.** If a function has 4+ levels of indentation, extract a named method rather than nesting more.

This principle overrides all other conventions when they conflict.

## Constructor Convention

```typescript
public class StorageService {
    private readonly _dbPath: string;
    
    public constructor(dbPath: string) {
        this._dbPath = dbPath;
    }
}
```

## Import Convention

```typescript
// React ecosystem
import { useState, useEffect } from "react";

// Mantine
import { Button, TextInput } from "@mantine/core";

// Project modules
import { StorageService } from "../services/StorageService";
import { IRecord } from "../types/IRecord";
```

## React Component Convention

```typescript
export const RecordForm = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);

    const HandleStartStop = (): void => {
        if (!isRecording) {
            StartRecording();
        } else {
            StopRecording();
        }
    };

    const StartRecording = (): void => { /* ... */ };
    const StopRecording = (): void => { /* ... */ };

    return (
        <Button onClick={HandleStartStop}>
            {isRecording ? "结束" : "开始"}
        </Button>
    );
};
```

## Comments

- **Write comments for WHY, not WHAT.** Good code says what it does. Comments say why — a hidden constraint, a subtle invariant, a bug workaround, behavior that would surprise a reader.
- **One-line comments only.** No multi-line docstrings, no JSDoc blocks. Keep it tight.
- **Don't comment obvious code.** `const records = this.GetRecords()` doesn't need a comment.
- **Don't reference tasks, PRs, or callers.** Those belong in commit messages, not in code that may outlive them.
- **When in doubt, leave it out.** If removing the comment wouldn't confuse a new developer a month from now, don't write it.
- **No `// added for X feature` or `// used by Y component`** — these rot.

Target density: one comment per 20-30 lines on average. A 200-line file should have 6-10 short comments, each explaining a non-obvious decision.

Components are the one place where React rules overrule C# conventions:
- Component functions use arrow syntax (React convention)
- Hooks must be `camelCase` (React rule, can't override)
- JSX props like `onClick` / `onChange` are framework API, not ours to rename
- JSX props like `onClick` / `onChange` are framework API, not ours to rename

## Rationale

- The author is a C# developer. TypeScript code should feel like reading C#.
- LLM coding agents follow explicit, boundary-clear rules better than vague ones.
- "One class per file" + named methods makes code greppable and debuggable.

---

## Git Commit Convention

- **提交信息统一使用中文（Chinese commit messages）**。项目面向中文用户，中文注释更直观。
- 格式：`<类型>: <简要描述>`，与常见 conventional commits 一致，只是语言用中文。
- 示例：
  - `修复: 热力图时区导致日期显示为空白的问题`
  - `重构: 将 better-sqlite3 迁移为 sql.js (WASM)`
  - `文档: 更新数据库指南，补充 sql.js 模式`
