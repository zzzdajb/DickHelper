# Application Shell & Navigation

> Overall layout and view-switching strategy for the Electron app.

---

## Layout

```
┌──────────────────────────────────────────┐
│  ┌─────────┐  ┌────────────────────────┐ │
│  │         │  │                        │ │
│  │ Navbar  │  │   Main Content Area    │ │
│  │ 200px   │  │                        │ │
│  │         │  │   (single active view) │ │
│  │ · 记录   │  │                        │ │
│  │ · 统计   │  │                        │ │
│  │ · 历史   │  │                        │ │
│  │ · 设置   │  │                        │ │
│  │         │  │                        │ │
│  └─────────┘  └────────────────────────┘ │
└──────────────────────────────────────────┘
```

## View Switching Strategy

**No React Router.** A single `activeView` state controls which component mounts. Each view renders exclusively — unmounted views don't consume resources.

```typescript
type View = "record" | "stats" | "history" | "settings";

const [activeView, setActiveView] = useState<View>("record");
```

## Views

| View ID | Component | Description |
|---------|-----------|-------------|
| `record` | `RecordForm` | Timer + notes + start/stop |
| `stats` | `StatsChart` | Stat cards + heatmap calendar |
| `history` | `HistoryList` | Browse, delete, clear records |
| `settings` | `Settings` | TBD — placeholder for future config |

## AppShell Implementation

Uses Mantine `AppShell` component:

```typescript
import { AppShell, Navbar } from "@mantine/core";
import { useState } from "react";

type View = "record" | "stats" | "history" | "settings";

export const App = () => {
    const [activeView, setActiveView] = useState<View>("record");

    return (
        <AppShell navbar={{ width: 200, breakpoint: 0 }}>
            <AppShell.Navbar p="md">
                {/* Nav buttons: filled when active, light otherwise */}
            </AppShell.Navbar>
            <AppShell.Main>
                {/* Conditionally render active view */}
            </AppShell.Main>
        </AppShell>
    );
};
```

## Navbar Items

Ordered by priority:

1. **记录** (Record) — default view
2. **统计** (Stats)
3. **历史** (History)
4. **设置** (Settings) — placeholder, content TBD

Nav items use Mantine `Button` with `variant={active ? "filled" : "light"}` for active state indication. Icons from `@tabler/icons-react` (Mantine's default icon library).

## Why Not React Router

1. Only 4 views — Router is overkill
2. Electron has no address bar — URL navigation adds no value
3. `useState` + conditional rendering is beginner-readable
4. Each view unmounts when switching (no background processes)
5. No nested routes, no URL params, no back/forward needed

If views grow beyond ~6 or nested sub-views are needed, revisit Router at that point.

## Window

- **Default size**: 960 × 680
- **Min size**: 800 × 600
- **No fullscreen by default** — content density doesn't justify it
- `backgroundColor: '#f5f5f5'` to avoid white flash on open
- `show: false` + `ready-to-show` — show window after React renders, avoids blank window flicker

```typescript
const mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#f5f5f5",
    show: false,
    webPreferences: {
        preload: join(__dirname, "preload.js"),
    },
});

mainWindow.once("ready-to-show", () => {
    mainWindow.show();
});
```

## System Tray

Minimize to tray instead of quitting. Close button hides to tray; right-click tray icon → "退出" actually quits.

- Tray icon: reuse app icon from `public/`
- Tray menu: "显示" (restore), "退出" (quit)
- Double-click tray icon: restore window

```typescript
// Conceptual sketch — actual API depends on electron-vite structure
const tray = new Tray(join(__dirname, "icon.png"));
tray.setToolTip("牛子小助手");
tray.on("double-click", () => mainWindow.show());
```

## App Identity

- **Chinese name**: 牛子小助手
- **English name**: DickHelper
- **Window title**: 牛子小助手

## Removed from Old Version

The following old-web features are irrelevant in Electron and will not be ported:

- GitHub Star button (no browser)
- UpdateDialog / version changelog popup (replaced by eventual auto-update)
- `chart.js` + `react-chartjs-2` dependencies (unused even in old version)
