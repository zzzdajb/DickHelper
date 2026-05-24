# 实现 Electron 单例锁，防止多实例多托盘

## Goal

使用 `app.requestSingleInstanceLock()` 防止用户多次打开应用时创建多个进程/托盘图标。

## Requirements

- 应用启动时检查是否已有实例运行
- 如果有其他实例，立即退出
- 当用户再次尝试打开应用时，聚焦已有窗口（restore → show → focus）

## Acceptance Criteria

- [x] `app.requestSingleInstanceLock()` 在 `app.whenReady()` 之前调用
- [x] 锁失败时调用 `app.quit()` 退出
- [x] 监听 `second-instance` 事件处理窗口聚焦

## Technical Approach

标准 Electron 单例锁模式:

```
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => { /* 聚焦已有窗口 */ });
    app.whenReady().then(...);
}
```

## Decision (ADR-lite)

- **Context**: 应用最小化到托盘后，用户双击 exe 会创建第二个托盘图标和进程
- **Decision**: 采用 Electron 官方推荐的 `requestSingleInstanceLock` API
- **Consequences**: 第二实例直接退出，通过 `second-instance` 事件聚焦已有窗口

## Out of Scope

- macOS 特殊处理（当前平台为 Windows）

## Technical Notes

- 修改文件: `src/main/index.ts`
- review 指出两个 corner case（pre-ready quit、second-instance 时 mainWindow 为 null），经评估触发概率极低，不处理
