# add-tabler-icons-to-electron-app

## Goal

给 Electron 应用（桌面图标 + 系统托盘图标）添加图标。

## Requirements

- 用 `stopwatch.png` 作为应用图标
- BrowserWindow 设置 `icon` 属性 → 任务栏图标
- 系统托盘用 `nativeImage.createFromPath()` 加载 PNG 替换硬编码 base64
- electron-builder.yml 配置 `icon` 字段 → 打包后桌面图标
- 三处共用同一个图标文件

## Acceptance Criteria

- [ ] 系统托盘正确显示 stopwatch 图标
- [ ] 任务栏正确显示 stopwatch 图标
- [ ] `npm run build` 通过
- [ ] electron-builder 打包包含图标配置

## Definition of Done

- Typecheck / lint 通过
- 托盘/任务栏图标正常显示

## Technical Notes

- 图标文件源: 用户提供的 `stopwatch.png`，位于项目根目录
- 移动到 `resources/` 目录统一管理
- `src/main/index.ts`: BrowserWindow + Tray 两处引用
- `electron-builder.yml`: 加 `icon` 字段
- Tabler icons 是 SVG 组件，主进程不能用，直接加载 PNG 文件
