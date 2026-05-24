# Directory Structure

> How frontend (renderer) code is organized in the Electron app.

---

## Directory Layout

```
src/
├── main/                           # Electron 主进程
│   ├── index.ts                    # 窗口创建、托盘、IPC 注册
│   └── database.ts                 # SQLite 初始化 + 查询封装
├── preload/
│   ├── index.ts                    # contextBridge API
│   └── index.d.ts                  # Window.electronAPI 类型声明
├── shared/
│   └── IUpdate.ts                  # main/preload/renderer 共享的 IPC 类型契约
├── renderer/                       # React 渲染进程
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # MantineProvider + AppShell + view switching
│   ├── index.html                  # Renderer HTML entry (electron-vite)
│   ├── views/
│   │   ├── RecordForm.tsx          # 计时器 + 备注 + 导入导出
│   │   ├── StatsChart.tsx          # 统计卡片 + 热力图
│   │   ├── HistoryList.tsx         # 记录列表 + 删除/清空
│   │   └── Settings.tsx            # 设置（占位）
│   ├── hooks/
│   │   ├── useRecords.ts           # 记录数据 hook（IPC 事件自动刷新）
│   │   └── useTimer.ts             # 计时器逻辑 hook
│   ├── services/
│   │   └── DatabaseService.ts      # IPC 调用封装 + 导入导出逻辑
│   └── types/
│       └── IRecord.ts              # IRecord / IStats / IDailyCount / IImportResult
└── resources/                      # 应用图标等静态资源
```

---

## Module Organization

- **main/**: Electron main process — one file per concern (app lifecycle, database)
- **preload/**: Security boundary — exposes only whitelisted IPC channels
- **shared/**: Type-only contracts shared across main/preload/renderer. Use this when preload would otherwise need to import renderer types.
- **renderer/views/**: One file per view. No subdirectories — only 4 views.
- **renderer/hooks/**: Reusable React hooks extracted from components
- **renderer/services/**: Pure logic classes with static methods. No React dependency.
- **renderer/types/**: Shared TypeScript interfaces. `I` prefix for all interfaces.

---

## Naming Conventions

- **Components**: PascalCase, named export (`export const RecordForm = () => {...}`)
- **Services**: PascalCase class with static methods (`DatabaseService.GetRecords()`)
- **Hooks**: camelCase, `use` prefix (`useRecords`, `useTimer`)
- **Types**: PascalCase, `I` prefix (`IRecord`, `IStats`, `IDailyCount`)
- **Files**: Match the primary export name exactly — `RecordForm.tsx` → `RecordForm`

---

## Rules

- New views go in `src/renderer/views/`
- Shared hooks go in `src/renderer/hooks/`
- Data access logic goes in `src/renderer/services/`, not in components
- Type-only files go in `src/renderer/types/`
- Main process code never imports from renderer (and vice versa)
- Preload code never imports from `src/renderer/`; shared IPC/event payload types go in `src/shared/`
