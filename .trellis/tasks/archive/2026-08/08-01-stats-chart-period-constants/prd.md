# 统计图表周期文案改为由常量渲染

## Goal

`08-01-stats-rolling-window-and-timezone` 收尾时发现 `StatsChart.tsx` 里还有三处硬编码的周期数字，与刚修复的「本月次数」属同一类文案漂移。其中「最近 12 个月」这处是**跨进程**的——决定月份数的代码在主进程，描述月份数的文案在渲染进程，两者毫无关联，是「本月次数」缺陷的未爆版本。

本任务把这三处接到常量上，并把跨进程的那个 12 下沉到 `packages/core`。

## What I already know

| 位置 | 内容 | 性质 |
|---|---|---|
| `src/renderer/views/StatsChart.tsx:346` | `<Title order={4}>90 天趋势</Title>` | 同文件漂移：`TREND_DAYS = 90` 就在第 40 行 |
| `src/renderer/views/StatsChart.tsx:348` | `最近 90 天的频率变化` | 同上 |
| `src/renderer/views/StatsChart.tsx:391` | `最近 12 个月的频率对比` | **跨进程漂移** |
| `src/main/database.ts:286` | `new Date(now.getFullYear(), now.getMonth() - 11, 1)` | 真正决定月份数的地方 |
| `src/main/database.ts:283` | 注释「按月统计次数（最近 12 个月，使用本地时区）」 | 第三份硬编码的 12 |

`TREND_DAYS` 已存在且被 `:129` / `:134` 正确使用——只有文案没接上，改常量不会改文案。

`packages/core/src/statsWindow.ts` 已在上个任务建立，`LAST_7_DAYS` / `LAST_30_DAYS` 住在里面；`src/main/database.ts` 与 `src/renderer/views/StatsChart.tsx` **都已经在从它导入**，管道现成。

`GetMonthlyTrend()` 目前无参数，月份数是后端自行决定的策略。

## Requirements

1. `StatsChart.tsx:346`、`:348` 的 90 改为渲染 `TREND_DAYS`
2. 在 `packages/core/src/statsWindow.ts` 新增 `MONTHLY_TREND_MONTHS = 12` 并从 `packages/core/src/index.ts` 导出
3. `src/main/database.ts` `GetMonthlyTrend()` 的起始月份改为由 `MONTHLY_TREND_MONTHS` 推导，注释里的 12 一并去掉硬编码
4. `StatsChart.tsx:391` 的 12 改为渲染 `MONTHLY_TREND_MONTHS`
5. IPC 契约不变——`GetMonthlyTrend()` 仍然无参数

## Acceptance Criteria

- [x] `npm run check` 全绿
- [x] `npm run build` 通过
- [x] 全仓搜索 `12 个月` / `90 天` 无残留；`getMonth() - 11` 已由 `MONTHLY_TREND_MONTHS - 1` 取代
- [x] 常量临时改为 6 实测：后端起始月份由 `2025-09` 变为 `2026-03`、跨度由 12 变 6 —— 两侧同源已证实
- [x] `TREND_DAYS` 临时改为 30 实测：三处文案均为引用同一绑定的 JSX 表达式（`{TREND_DAYS} 天趋势`、`最近 {TREND_DAYS} 天的频率变化`、`最近 {MONTHLY_TREND_MONTHS} 个月的频率对比`），不含任何字面量
- [x] 实验后已恢复 `MONTHLY_TREND_MONTHS = 12`、`TREND_DAYS = 90`，并重新跑通 check 与 build

## Definition of Done

- 测试与类型检查通过
- commit message 用中文，说明是延续上个任务的同类文案漂移清理

## Technical Approach

沿用上个任务确立的模式：周期长度只存一份，UI 文案从同一个源渲染，使文案与实现在结构上无法漂移。

`TREND_DAYS` 保持在 `StatsChart.tsx` 本地——它只被渲染进程使用，后端不参与，无需下沉。
`MONTHLY_TREND_MONTHS` 必须下沉 core——它是主进程与渲染进程之间的隐式契约。

不改 `GetMonthlyTrend()` 的签名。让渲染进程传参在架构上更干净，但当前没有「可切换 12/24 个月」的需求，而 `code-style.md` 明确要求不为假想的未来需求做设计。

## Decision (ADR-lite)

**Context**：同一个周期长度在主进程与渲染进程各写一份，无任何关联，改一侧不会带动另一侧。

**Decision**：跨进程的 `MONTHLY_TREND_MONTHS` 下沉 `packages/core/src/statsWindow.ts`，两侧各自导入；仅渲染进程使用的 `TREND_DAYS` 留在本地，只把文案接上。IPC 契约不变。

**Consequences**：`statsWindow.ts` 从「滚动窗口」扩展为「统计周期常量」的归属地，语义略微变宽但仍内聚；后续若真要做可切换范围，再改 IPC 也不迟。

## Out of Scope

- 不改 `GetMonthlyTrend()` 的 IPC 签名
- 不动热力图的 `WEEKS_TO_SHOW = 4`（无对应的数字文案，不存在漂移）
- 不接 CI、不动 AI 分析功能存废

## Technical Notes

延续任务：`.trellis/tasks/archive/2026-08/08-01-stats-rolling-window-and-timezone`（PR #42）。该任务的 `cross-layer-thinking-guide.md` 更新中已写明「窗口长度与 UI 文案渲染自同一常量」的约定，本任务是同一约定在图表周期上的补齐。
