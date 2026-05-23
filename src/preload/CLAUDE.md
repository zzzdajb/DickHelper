[根目录](../../CLAUDE.md) > [src](../) > **preload**

# Preload 模块 -- 安全桥接层

## 模块职责

Electron 安全边界层，通过 `contextBridge.exposeInMainWorld` 将主进程 IPC 通道暴露为 `window.electronAPI`。确保渲染进程无法直接访问 Node.js API。

## 入口与启动

- **入口文件**：`index.ts`（构建输出为 `index.cjs`，CommonJS 格式）
- **加载时机**：BrowserWindow 创建时通过 `webPreferences.preload` 指定

## 对外接口

### `window.electronAPI`

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetRecords` | `() => Promise<IRecordRaw[]>` | 获取所有记录 |
| `SaveRecord` | `(startTime, endTime, duration, notes?) => Promise<IRecordRaw>` | 保存记录 |
| `DeleteRecord` | `(id) => Promise<boolean>` | 删除记录 |
| `ClearAll` | `() => Promise<void>` | 清空所有记录 |
| `GetStats` | `() => Promise<IStats>` | 获取统计数据 |
| `GetDailyCounts` | `(startTimestamp, endTimestamp) => Promise<IDailyCount[]>` | 获取每日计数 |
| `ImportRecords` | `(records) => Promise<IImportResult>` | 批量导入 |
| `OnRecordsUpdated` | `(callback) => () => void` | 监听数据更新事件，返回取消监听函数 |

## 关键依赖与配置

- `electron`：`contextBridge`、`ipcRenderer`
- 构建输出格式：CommonJS（`electron.vite.config.ts` 中配置 `output.format: "cjs"`）

## 数据模型

类型声明在 `index.d.ts` 中，为 `window.electronAPI` 提供 TypeScript 类型支持。类型引用自 `src/renderer/types/IRecord.ts`。

## 测试与质量

- 无测试文件
- 缺口：预加载脚本加载失败时仅输出 console.error，无用户可见的错误提示

## 相关文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `index.ts` | 31 | contextBridge 暴露 electronAPI |
| `index.d.ts` | 27 | window.electronAPI 全局类型声明 |

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-24 00:43:49 | 初始生成 | 首次扫描生成 |
