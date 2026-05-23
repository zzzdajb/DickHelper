# DickHelper (牛子小助手) v2 — PRD

## 项目概述

基于旧版 Web 端 DickHelper (React + localStorage) 的完全重写。新版转型为 Electron 桌面应用，使用更现代的技术栈，优化界面设计。所有旧版功能保留，数据通过 JSON 文件导入兼容。

- **旧版仓库**: https://github.com/zzzdajb/DickHelper
- **旧版 Demo**: https://dick.juwo.my
- **应用名**: 牛子小助手 / DickHelper

---

## 技术栈

| 层 | 选择 |
|----|------|
| Desktop Shell | Electron |
| UI Framework | React 19.2 |
| Language | TypeScript 5.9 (strict, C# 风格) |
| Build | Vite 6.3 + electron-vite |
| UI Library | Mantine 7 |
| Icons | @tabler/icons-react (Mantine 默认) |
| Database | SQLite via better-sqlite3 |
| Charts | 纯 CSS 热力图（旧版方案，chart.js 不引入） |

---

## 架构概览（目标）

```
src/
├── main/                       # Electron 主进程
│   ├── index.ts                # 窗口创建、托盘、IPC 注册
│   └── database.ts             # SQLite 初始化 + 查询封装
├── preload/
│   └── index.ts                # contextBridge API 暴露
├── renderer/                   # React 渲染进程
│   ├── App.tsx                 # Mantine AppShell + view switching
│   ├── views/
│   │   ├── RecordForm.tsx      # 计时器 + 备注 + 导入导出
│   │   ├── StatsChart.tsx      # 统计卡片 + 热力图
│   │   ├── HistoryList.tsx     # 记录列表 + 删除/清空
│   │   └── Settings.tsx        # 设置（占位）
│   ├── components/             # 共享组件
│   ├── services/
│   │   └── DatabaseService.ts  # 数据库查询业务逻辑
│   ├── types/
│   │   └── IRecord.ts          # 数据模型接口
│   └── hooks/
│       ├── useRecords.ts       # 记录数据 hook
│       └── useTimer.ts         # 计时器逻辑 hook
└── resources/                  # 应用图标等静态资源
```

### 组件树（目标）

```
<App>
  <MantineProvider>
    <AppShell>
      <AppShell.Navbar>            ← 左侧导航栏 200px
        · 记录 | 统计 | 历史 | 设置
      </AppShell.Navbar>
      <AppShell.Main>              ← 右侧内容区，单视图渲染
        {activeView === "record"   && <RecordForm />}
        {activeView === "stats"    && <StatsChart />}
        {activeView === "history"  && <HistoryList />}
        {activeView === "settings" && <Settings />}
      </AppShell.Main>
    </AppShell>
  </MantineProvider>
</App>
```

---

## 窗口设计

| 属性 | 值 |
|------|-----|
| 默认尺寸 | 960 × 680 |
| 最小尺寸 | 800 × 600 |
| 背景色 | #f5f5f5 (避免白屏闪烁) |
| 启动行为 | ready-to-show 后再显示窗口 |
| 托盘 | 关闭 → 缩小到托盘，右键退出 |
| 自动更新 | 初版不做 |

---

## 数据模型（新版）

```typescript
interface IRecord {
    readonly Id: string;       // UUID v4 (crypto.randomUUID)
    readonly StartTime: Date;  // 计时器开始时间 (修复旧版语义)
    readonly EndTime: Date;    // 计时器结束时间 (旧版误称为 startTime)
    readonly Duration: number; // 分钟，保留两位小数
    readonly Notes?: string;   // 可选备注
}
```

**修复**: 旧版 `startTime` 实际存的是结束时间。新版拆为 `StartTime` 和 `EndTime`，语义正确。

SQLite 表结构：

```sql
CREATE TABLE Records (
    Id        TEXT PRIMARY KEY,
    StartTime TEXT NOT NULL,  -- ISO 8601
    EndTime   TEXT NOT NULL,  -- ISO 8601
    Duration  REAL NOT NULL,
    Notes     TEXT
);
```

---

## 数据流（新版）

```
Renderer (React)  →  IPC (invoke)  →  Main Process  →  SQLite (better-sqlite3)
```

- 主进程持有 SQLite 连接，渲染进程通过 `contextBridge` + `ipcRenderer.invoke` 异步调用
- 统计计算下放到 SQL（`SELECT COUNT(*), AVG(Duration) FROM Records`），不在 JS 里遍历
- 记录变更后通过 IPC event 通知渲染进程刷新，替代旧版 CustomEvent 模式

---

## 功能清单

### 1. 计时记录 (RecordForm)
- 开始/暂停/继续/停止计时器
- 暂停状态持久化到内存（但仍不跨会话）
- 停止时自动保存（StartTime + EndTime + Duration）
- 可选备注
- 导出数据为 JSON（格式兼容旧版）
- 从 JSON 文件导入（支持旧版格式自动识别和字段映射）

### 2. 统计看板 (StatsChart)
- 4 个统计卡片：总次数、平均时长、本周次数、本月次数
- 发射日历热力图（4 周 × 7 天，5 级颜色）
- 数据从 SQLite 查询，不遍历 JS 数组

### 3. 历史记录 (HistoryList)
- 倒序显示所有记录
- 单条删除 / 清空全部（带确认对话框）
- IPC 事件自动刷新

### 4. 设置 (Settings)
- MVP 阶段占位页面，内容 TBD

### 5. 系统托盘
- 关闭窗口 → 缩到托盘
- 托盘右键菜单：显示 / 退出
- 双击托盘图标 → 恢复窗口

### 6. 数据迁移
- 用户从旧版导出 `masturbation_records.json`
- 新版导入时自动识别旧格式（无 `version` 字段 → 旧版格式）
- `startTime` 自动映射到 `EndTime`
- 按 `id` 去重，跳过重复 UUID
- 详见 `docs/migration-guide.md`（用户向）和 `data-migration.md`（技术向）

---

## 砍掉的功能（旧版有，新版不做）

- GitHub Star 按钮（Electron 无意义）
- UpdateDialog 更新公告弹窗（未来用自动更新替代）
- chart.js / react-chartjs-2 依赖（旧版未实际使用）
- uuid 依赖（Electron 内置 crypto.randomUUID）

---

## 性能策略

| 策略 | 优先级 |
|------|--------|
| SQLite 跑在主进程，IPC 异步调用 | P0 架构决定 |
| 统计计算下放 SQL | P0 顺手做 |
| ready-to-show 防白屏 | P0 一行代码 |
| 窗口 GPU 加速 | P1 默认配置 |
| 虚拟列表 | 延后 — 数据量小时无必要 |

---

## 代码风格

详见 `code-style.md`。核心原则：
- C# / .NET 风格 TypeScript
- 新手友好优先 — 三行重复好过一个过早抽象
- 注释只解释 WHY，不解释 WHAT

---

## 非功能需求

- **暂不做**: 自动更新、数据库加密、多窗口/悬浮窗、多语言
- **延后评估**: 虚拟列表（数据量大时）、深色模式（Mantine 原生支持，一句代码启用）
