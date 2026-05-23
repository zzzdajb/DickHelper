[根目录](../../CLAUDE.md) > [src](../) > **main**

# Main 模块 -- Electron 主进程

## 模块职责

Electron 主进程层，负责：
- 应用生命周期管理（`app.whenReady`、`before-quit`）
- BrowserWindow 创建与配置
- 系统托盘（Tray）管理（关闭窗口缩到托盘）
- SQLite 数据库初始化与持久化
- IPC 通道注册（`ipcMain.handle`）

## 入口与启动

- **入口文件**：`index.ts`
- **启动流程**：
  1. `app.whenReady()` 触发
  2. `DatabaseService.create()` 异步初始化 SQLite（sql.js WASM）
  3. `RegisterIpcHandlers()` 注册所有 IPC 通道
  4. `CreateWindow()` 创建 BrowserWindow（`show: false`，等 `ready-to-show` 再显示）
  5. `CreateTray()` 创建系统托盘

## 对外接口

### IPC 通道（Main -> Renderer 通过 `ipcMain.handle`）

| 通道名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `records:get-all` | 无 | `IDbRecord[]` | 获取所有记录，按 EndTime 降序 |
| `records:save` | `startTime, endTime, duration, notes?` | `IDbRecord` | 保存新记录 |
| `records:delete` | `id` | `boolean` | 删除单条记录 |
| `records:clear-all` | 无 | `void` | 清空所有记录 |
| `records:get-stats` | 无 | `IStats` | 获取统计数据（总数/平均时长/周频/月频） |
| `records:get-daily-counts` | `startTimestamp, endTimestamp` | `IDailyCount[]` | 获取日期范围内每日计数 |
| `records:import` | `records[]` | `IImportResult` | 批量导入（带去重和校验） |

### IPC 事件（Main -> Renderer 通过 `webContents.send`）

| 事件名 | 触发时机 |
|--------|---------|
| `records-updated` | 保存、删除、清空、导入操作后 |

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `sql.js` | SQLite WASM 实现，在 Node.js 主进程中运行 |
| `electron` | 桌面应用框架 |
| `node:crypto` | `randomUUID()` 生成记录 ID |
| `node:fs` | 数据库文件读写（`dickhelper.db`） |

- 数据库路径：`app.getPath("userData")/dickhelper.db`
- 窗口配置：960x680，最小 800x600，背景色 `#f5f5f5`
- 安全配置：`contextIsolation: true`，`nodeIntegration: false`

## 数据模型

### Records 表

```sql
CREATE TABLE IF NOT EXISTS Records (
    Id        TEXT PRIMARY KEY,    -- UUID
    StartTime TEXT NOT NULL,       -- ISO 8601
    EndTime   TEXT NOT NULL,       -- ISO 8601
    Duration  REAL NOT NULL,       -- 分钟（浮点数）
    Notes     TEXT                 -- 可选备注
)
```

### DatabaseService 类

- **工厂模式**：`DatabaseService.create()` 异步创建实例（WASM 初始化是异步的）
- **私有方法**：`_save()` 将内存数据库导出到文件、`_queryAll()` / `_queryOne()` 查询封装
- **公开方法**：`GetRecords`、`SaveRecord`、`DeleteRecord`、`ClearAll`、`GetStats`、`GetDailyCounts`、`ImportRecords`、`RecordExists`、`Close`

## 测试与质量

- 无测试文件
- 类型安全：TypeScript strict 模式
- 缺口：无单元测试覆盖 DatabaseService 的 CRUD 和边界情况

## 常见问题 (FAQ)

**Q: 为什么用 sql.js 而不是 better-sqlite3？**
sql.js 是纯 WASM 实现，不需要 native 编译，跨平台打包更简单。

**Q: 数据库文件在哪里？**
`app.getPath("userData")/dickhelper.db`，Windows 上通常是 `%APPDATA%/dickhelper/`。

**Q: 关闭窗口会退出应用吗？**
不会。关闭窗口时会缩到系统托盘，需要通过托盘右键菜单"退出"才能真正退出。

## 相关文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `index.ts` | 194 | 应用入口、窗口、托盘、IPC 注册 |
| `database.ts` | 257 | DatabaseService：SQLite CRUD + 统计 + 导入 |

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-24 00:43:49 | 初始生成 | 首次扫描生成 |
