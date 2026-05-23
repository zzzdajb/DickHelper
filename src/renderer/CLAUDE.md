[根目录](../../CLAUDE.md) > [src](../) > **renderer**

# Renderer 模块 -- React UI 层

## 模块职责

Electron 渲染进程，提供用户界面。基于 React 19 + Mantine 7 组件库构建，使用 `useState` 实现视图切换（无路由库），通过 `window.electronAPI` 与主进程通信。

## 入口与启动

- **HTML 入口**：`index.html`（electron-vite 自动处理）
- **React 入口**：`main.tsx` -> `App.tsx`
- **启动流程**：
  1. `main.tsx`：`createRoot` 挂载 `<App />`
  2. `App.tsx`：`MantineProvider` 包裹 + `AppShell` 布局 + 四个视图切换

## 对外接口

本模块是终端 UI 层，不对外暴露 API。通过 `window.electronAPI`（Preload 层）调用主进程服务。

## 子模块结构

### views/ -- 视图组件

| 文件 | 行数 | 说明 |
|------|------|------|
| `RecordForm.tsx` | 138 | 计时器界面：开始/暂停/继续/停止 + 备注输入 |
| `StatsChart.tsx` | 257 | 统计面板：4 个统计卡片 + 4 周热力图 |
| `HistoryList.tsx` | 131 | 历史记录列表：浏览、删除单条、清空全部（带确认弹窗） |
| `Settings.tsx` | 156 | 设置页面：数据导入/导出 + 应用信息展示 |

### hooks/ -- React Hooks

| 文件 | 行数 | 说明 |
|------|------|------|
| `useRecords.ts` | 45 | 记录数据加载 Hook，监听 `records-updated` IPC 事件自动刷新 |
| `useTimer.ts` | 131 | 计时器逻辑 Hook：Start/Pause/Resume/Stop，支持暂停时间累计扣除 |

### services/ -- 服务层

| 文件 | 行数 | 说明 |
|------|------|------|
| `DatabaseService.ts` | 144 | IPC 调用封装：ISO 字符串与 Date 转换、JSON 导入导出（兼容旧版格式） |

### types/ -- 类型定义

| 文件 | 行数 | 说明 |
|------|------|------|
| `IRecord.ts` | 37 | 共享接口：`IRecord`、`IRecordRaw`、`IStats`、`IDailyCount`、`IImportResult` |

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `react` / `react-dom` | UI 框架 |
| `@mantine/core` / `@mantine/hooks` | 组件库 |
| `@tabler/icons-react` | 图标 |

- 主题字体：思源黑体 / Noto Sans SC
- 默认圆角：`md`
- 侧边栏宽度：220px

## 数据模型

### IRecord（UI 层使用，Date 对象）

```typescript
interface IRecord {
    readonly Id: string;
    readonly StartTime: Date;
    readonly EndTime: Date;
    readonly Duration: number;    // 分钟
    readonly Notes?: string;
}
```

### IRecordRaw（IPC 传输用，ISO 字符串）

```typescript
interface IRecordRaw {
    readonly Id: string;
    readonly StartTime: string;   // ISO 8601
    readonly EndTime: string;     // ISO 8601
    readonly Duration: number;
    readonly Notes: string | null;
}
```

### 导入格式兼容

`DatabaseService.ImportFromJson` 支持两种格式：
- **旧版**：JSON 数组，字段为小驼峰（`id`、`startTime`、`duration`），其中 `startTime` 实际是结束时间
- **新版**：`{ version: 1, records: [...] }`，字段为 PascalCase（`Id`、`StartTime`、`EndTime`、`Duration`）

## 测试与质量

- 无测试文件
- ErrorBoundary 组件捕获渲染错误，显示错误信息和重载按钮
- 缺口：无组件测试、无 Hook 测试、无导入导出逻辑测试

## 常见问题 (FAQ)

**Q: 如何新增一个视图？**
1. 在 `views/` 下创建 `.tsx` 文件
2. 在 `App.tsx` 的 `View` 类型和 `NAV_ITEMS` 数组中添加条目
3. 在 `AppShell.Main` 的条件渲染中添加对应组件

**Q: 为什么不用 React Router？**
只有 4 个视图，`useState` 视图切换足够简单，无需引入路由库。

**Q: 数据从哪里来？**
所有数据通过 `DatabaseService`（静态方法）调用 `window.electronAPI`，最终由主进程的 SQLite 数据库提供。

## 相关文件清单

| 文件 | 说明 |
|------|------|
| `main.tsx` | React 挂载入口 |
| `App.tsx` | 根组件、ErrorBoundary、主题、布局 |
| `env.d.ts` | Vite 客户端类型引用 |
| `index.html` | HTML 模板 |
| `views/RecordForm.tsx` | 计时器 + 记录表单 |
| `views/StatsChart.tsx` | 统计卡片 + 热力图 |
| `views/HistoryList.tsx` | 历史记录列表 |
| `views/Settings.tsx` | 设置：导入/导出/关于 |
| `hooks/useRecords.ts` | 记录数据 Hook |
| `hooks/useTimer.ts` | 计时器逻辑 Hook |
| `services/DatabaseService.ts` | IPC 封装 + 导入导出 |
| `types/IRecord.ts` | 共享类型定义 |

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-24 00:43:49 | 初始生成 | 首次扫描生成 |
