# Electron前端UI美化与导入导出功能迁移

## Goal

将 DickHelper Electron 应用的前端进行全面现代化 UI 设计改造，同时将导入/导出记录功能从 RecordForm（计时页面）迁移至设置页面，使功能分区更合理。

## What I already know

* 项目使用 React 19 + Mantine 7 + Tabler Icons，构建工具为 electron-vite
* 当前布局：左侧 200px 固定导航栏（4 项：记录/统计/历史/设置），右侧内容区
* 4 个视图组件：RecordForm（计时+导入导出）、StatsChart（统计看板+热力图）、HistoryList（历史列表）、Settings（占位页）
* 全部样式通过 Mantine 组件属性 + 少量内联 style 完成，无 CSS 文件
* 当前配色：蓝色主色 + 灰色背景 + 绿色热力图
* 导入/导出按钮当前位于 RecordForm 底部，导出使用 Blob 下载 JSON，导入使用隐藏的 `<input type="file">`
* Settings 页面目前只是一个占位组件（标题 + "更多设置功能即将推出..."）
* 数据库服务通过 IPC 桥接，导入/导出逻辑在 `DatabaseService.ts` 中

## Assumptions (temporary)

* 用户希望保留所有现有功能，只改 UI 外观和功能位置
* 不需要添加路由库，保持简单 state 切换
* Mantine 7 组件库能力足以支撑现代 UI 设计
* 深色模式不在本次范围

## Open Questions

* 设置页面结构：迁移导入导出后如何组织设置页？
* 侧边栏是否需要其他调整（Logo、分组、活跃态样式）？
* 各视图的 Paper 卡片是否需要替换为更现代的设计？

## Decisions

* **布局**: 现代侧边栏（方案 1）— 保持左侧导航，升级视觉细节
* **配色**: Mantine 默认配色方案（移除显式 `primaryColor: "blue"`，使用框架默认值）
* **设置页结构**: 分组卡片式 — 数据管理区（导入/导出）+ 关于区 + 未来扩展位
* **侧边栏**: Logo 区(顶部) → 功能导航(中) → 设置(底部固定)，选中态左侧指示条

## Requirements (evolving)

* 全面现代化 UI 设计
* 将导入/导出记录功能从 RecordForm 迁移到 Settings 页面
* 保持所有现有功能不变
* 设置页面：数据管理（导入/导出）+ 关于（版本信息）两个分组

## Acceptance Criteria (evolving)

* [ ] 导入/导出按钮从 RecordForm 移除
* [ ] Settings 页面包含数据管理（导入/导出 JSON）和关于（版本信息）
* [ ] 侧边栏视觉升级（保留导航逻辑不变）
* [ ] 各视图卡片样式现代化
* [ ] UI 整体呈现现代化设计风格
* [ ] 所有现有功能正常工作

## Definition of Done

* Lint / typecheck 通过
* 所有视图功能正常（计时、统计、历史、设置+导入导出）
* 代码整洁，无不必要的注释

## Out of Scope (explicit)

* 深色模式（后续迭代）
* 新增路由库
* 数据库结构变更
* 后端逻辑改动

## Technical Notes

* App.tsx: 根布局，MantineProvider + AppShell + 4 NavLink
* RecordForm.tsx: 计时器 + 备注 + 导入导出按钮
* Settings.tsx: 当前为占位组件
* StatsChart.tsx: 统计卡片 + 热力图
* HistoryList.tsx: 记录列表 + 删除/清空
* DatabaseService.ts: 导入导出逻辑（ExportToJson, ImportFromJson）
