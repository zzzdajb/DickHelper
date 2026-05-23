# Component Guidelines

> How React components are built in the Electron renderer.

---

## Component Structure

Each component file follows this layout:

```typescript
// 1. Imports — React first, then Mantine, then project modules
import { useState, useEffect } from "react";
import { Paper, Stack, Title, Button, Text } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";
import type { IRecord } from "../types/IRecord";

// 2. Component — arrow function, named export, PascalCase
export const RecordForm = () => {
    // 3. All hooks at the top (useState, custom hooks)
    const [notes, setNotes] = useState<string>("");
    const { records, refresh } = useRecords();

    // 4. Named handler functions (PascalCase, Handle prefix)
    const HandleSave = (): void => { ... };
    const HandleDelete = (id: string): void => { ... };

    // 5. Return JSX
    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            ...
        </Paper>
    );
};
```

## Component Props

Props are defined inline when needed. If a sub-component is extracted, its props interface goes right above it:

```typescript
const StatCard = ({ title, value }: { title: string; value: string | number }) => (
    <Paper shadow="sm" radius="md" p="md" withBorder>
        <Text size="sm" c="dimmed">{title}</Text>
        <Text size="xl" fw={700} c="blue">{value}</Text>
    </Paper>
);
```

No `React.FC` — use destructured inline types.

## Styling Patterns

- **Mantine props exclusively** — `p`, `m`, `radius`, `shadow`, `c` (color), `fw` (font weight), `size`
- **Mantine `style` prop** for one-off values not covered by Mantine style props (e.g., `borderRadius`, custom `backgroundColor`)
- **No CSS modules, no Tailwind, no styled-components**
- **No hardcoded color hex values** — use Mantine color tokens: `c="blue"`, `c="dimmed"`, `c="red"`
- **`Paper` for cards** — `shadow="sm" radius="md" p="lg" withBorder` is the standard card pattern
- **`Stack` for vertical spacing** — `gap="md"` for consistent spacing between siblings
- **`Group` for horizontal layout** — `justify="space-between"` for headers with action buttons

## Compound Components

Mantine exposes compound components via dot notation:

```typescript
<AppShell navbar={{ width: 200, breakpoint: 0 }}>
    <AppShell.Navbar p="md">
        {/* Navigation items */}
    </AppShell.Navbar>
    <AppShell.Main>
        {/* Active view */}
    </AppShell.Main>
</AppShell>
```

## Cross-Component Communication

Components do NOT share state directly. Data flows through:
1. `DatabaseService` (IPC to main process → SQLite)
2. `records-updated` IPC event (main → renderer)
3. `useRecords` hook (single source of truth for record data)

No React Context. No prop drilling deeper than 1 level. Each view is self-contained.

## Components NOT Ported from Old Version

- **UpdateDialog** — irrelevant in Electron (no version changelog popup)
- **GitHub Star button** — irrelevant in Electron (no browser)
