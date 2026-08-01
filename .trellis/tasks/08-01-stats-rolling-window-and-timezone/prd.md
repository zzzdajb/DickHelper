# 统计口径改为滚动窗口 + core 时区基准统一

## Goal

统计界面的「本月次数」卡片标题说日历月、副标题说「最近 30 天」、底层实现是日历月至今（MTD）—— 三者互相矛盾。同时发现 `packages/core` 的分析数据构造全程使用 UTC，而桌面端数据库层全程使用本地时区，导致 AI 分析报出的「高峰时段」在 UTC+8 下整体偏移 8 小时。

本任务把统计口径统一为**滚动窗口**（近 7 天 / 近 30 天），把窗口天数与计数逻辑下沉到 `packages/core` 作为单一真相源，并将 core 的时区基准对齐到本地时区。

选择滚动窗口而非日历月的产品理由：本应用记录的是**行为频率**，频率必须有固定分母。日历月的分母从 1 天涨到 31 天，月初与月末根本不可比；而卡片旁边的「本周次数」本来就是滚动 7 天，两种尺度并排会诱导用户做错误的横向对比。

## What I already know

### 缺陷现状（已逐处核实）

| 位置 | 现状 |
|---|---|
| `src/main/database.ts:204` | `monthStart = new Date(now.getFullYear(), now.getMonth(), 1)` — 日历月至今 |
| `src/main/database.ts:201` | `oneWeekAgo = now - 7d` — 滚动 7 天，正确 |
| `src/renderer/views/StatsChart.tsx:271-277` | title「本月次数」+ description「最近 30 天」— 与实现三方矛盾 |
| `src/renderer/views/StatsChart.tsx:265-270` | title「本周次数」+ description「最近 7 天」— 标题模糊但自洽，未撒谎 |
| `apps/mobile/app/(tabs)/stats.tsx:28` | 同样是日历月，但 MetricTile 标题直接写「近 30 天」，无副标题兜底 |
| `packages/core/src/ai/buildAnalysisData.ts:43` | 同样是日历月 |
| `packages/core/src/ai/buildAnalysisData.ts:30,33,36` | `getUTCHours` / `getUTCDay` / `getUTCFullYear+getUTCMonth` |
| `src/main/database.ts:249,266,283` | 三处分布统计均为本地时区，且带 `/** 使用本地时区 */` 注释 |

`FrequencyPerMonth` 的三份独立实现：`database.ts`（SQL COUNT）、`buildAnalysisData.ts`（内存遍历）、`stats.tsx`（内存遍历）。其中 `stats.tsx` 同一屏内既自己数一遍喂 MetricTile，又调用 `BuildAnalysisData(records)` 让 core 再数一遍喂 AI。

### 成因

`git log -L` 定位到 `9b34df8 feat: polish Electron UI with Mantine defaults` —— 一个纯 UI 美化提交给两张卡片补 `description`，「本周次数 / 最近 7 天」恰好正确，于是对称地给月编了「最近 30 天」，未核对 `database.ts`。

时区偏移源于 `.trellis/tasks/archive/2026-05/05-31-mobile-ai-analysis`：`BuildAnalysisData` 是为替代桌面端 SQLite 聚合而**重写**的，重写时基准从本地飘到了 UTC。

根因是同一语义存在三份独立实现、UI 文案独立手写，漂移是结构性必然。

### 严重度重估

时区缺陷的唯一露头处是 AI 分析（`BuildPrompt` / `AnalyzeLocally`）。桌面端雷达图、星期图、月度柱状图全部走 `database.ts`，一直正确；移动端无小时图表。经与需求方确认，**AI 分析功能实际近乎无人使用、零用户反馈、现阶段偏噱头**，因此该缺陷真实影响接近零。口径缺陷才是每个打开统计页的用户都会遇到的问题。

### 现有测试为何没能拦住

`packages/core/test/ai.test.ts:186-192` 的 `CreateRecordAtHour` 用 UTC 字面量构造记录，实现用 `getUTCHours()` 读取 —— 两边同号相消，`HourlyDistribution[0]?.Count === 1` 恒真。测试验证的是「UTC 写进去、UTC 读出来」，从未验证「用户看到的小时 == 用户经历的小时」。6 条绿色测试掩护了一个 8 小时的错位。

`.github/workflows/release.yml` 只有 `npx tsc -b --noEmit` + `npm run build` + electron-builder；`npm run check`（含 `test:core`）**从未在 CI 执行**，测试只在开发者本机运行。

## Requirements

按两个提交组织，互相独立、可分别回退。

### 提交一 · `fix:` 时区基准统一到本地

1. `packages/core/src/ai/buildAnalysisData.ts` 的 `getUTCHours` / `getUTCDay` / `getUTCFullYear` / `getUTCMonth` 全部改为本地时区版本，与 `database.ts` 既有契约对齐。
2. `packages/core` 的测试脚本显式钉死一个**非零偏移**时区（如 `Asia/Shanghai`）。**禁止钉 UTC** —— 钉 UTC 会让此类缺陷永远测不出来。Windows 下 npm script 的 `TZ=xxx` 前缀不生效，需引入 `cross-env` 作为 devDependency。
3. `ai.test.ts` 的 `CreateRecordAtHour` 等辅助函数改为构造**本地**时间，现有断言相应重新对齐。本地化辅助函数后，现有断言即自动等价于「本地 N 点的记录落在 slot N」，回归保护随之免费获得。

### 提交二 · `refactor:` 统计口径改为滚动窗口

4. 在 `packages/core` 建立窗口的单一真相源，导出：
   - 窗口天数常量（`Week: 7`、`Month: 30`）
   - 窗口起点函数（供桌面端 SQL 路径取边界值）
   - 窗口计数函数（供 `buildAnalysisData` 与移动端共用）

   计数函数是关键：仅共享天数常量只能保证天数一致，保证不了边界符（`>=` vs `>`）、是否过滤已删除记录等细节一致；共享函数才能锁住这些，且能被单元测试直接打。

5. 三处调用点全部改为引用该真相源：
   - `src/main/database.ts` `GetStats()` — 保留 SQL COUNT，仅把边界参数换成窗口起点函数的输出
   - `packages/core/src/ai/buildAnalysisData.ts` — 内部改调窗口计数函数
   - `apps/mobile/app/(tabs)/stats.tsx` `CalculateMetrics()` — 保留外壳（`latestEndTime` 需要落脚点），把数数那几行换成调用窗口计数函数

6. 字段重命名，消除「月」的语义暗示：
   - `IStats.FrequencyPerWeek` → `Last7DayCount`，`FrequencyPerMonth` → `Last30DayCount`（`packages/shared/src/IRecord.ts:21-26`）
   - `IAiAnalysisData` 同名字段同步重命名（`packages/core/src/ai/ai.types.ts:11-12`）
   - `IStats` 仅走进程内 IPC（`src/preload/index.d.ts:34` → `src/renderer/services/DatabaseService.ts:77` → `StatsChart.tsx`），不落盘、不进导出 JSON、不进遥测，改名零兼容风险

7. UI 文案，天数由常量渲染，不再手写：

   | 卡片 | title | description |
   |---|---|---|
   | 周 | `近 ${窗口天数.Week} 天` | 滚动窗口 |
   | 月 | `近 ${窗口天数.Month} 天` | 滚动窗口，非自然月 |

   月那张多一句「非自然月」是刻意的不对称：只有它发生了行为变更，需要向老用户解释数字为何变大；周那张行为未变，无需道歉。

   移动端 `MetricTile` 标题同样改为常量渲染。

8. 文案同步修改：
   - `packages/core/src/ai/buildPrompt.ts:15-16`「本周频率」「本月频率」
   - `packages/core/src/ai/analyzeLocally.ts:33,35,37`「本周频率约 X 次」

9. 两条 commit message 均使用中文，各自明确点明是缺陷修复还是口径调整。

## Acceptance Criteria

- [ ] `npm run check` 全绿（typecheck ×3 + lint + test:core + mobile:export）
- [ ] `packages/core` 测试在钉死的非零时区下运行，`ai.test.ts` 辅助函数使用本地时间构造
- [ ] 在 UTC+8 环境下，一条本地 00:30 的记录，其 `HourlyDistribution` 落在 slot 0（旧实现下会落在 slot 16）
- [ ] 全仓搜索 `FrequencyPerWeek` / `FrequencyPerMonth` 无残留
- [ ] 全仓搜索 UI 层硬编码的「7 天」「30 天」字面量无残留（天数均由常量渲染）
- [ ] `packages/core/src/ai/buildAnalysisData.ts` 中无 `getUTC` 前缀调用
- [ ] 桌面端统计页：「近 30 天」数值 ≥ 改动前的「本月次数」，越靠近月初差值越大；「近 7 天」数值不变
- [ ] 移动端统计页两张 MetricTile 与桌面端同名卡片口径一致
- [ ] 窗口计数函数有直接的单元测试覆盖（含边界：恰好落在窗口起点的记录计入）
- [ ] 两个提交可独立回退，回退口径调整不会连带回退时区修复

## Definition of Done

- 测试已补充/更新，`npm run check` 本机通过
- lint / typecheck 全绿
- 行为变更已在 commit message 中用中文交代清楚
- 无需 docs 更新（无对外文档描述此口径）

## Technical Approach

单一真相源置于 `packages/core`，向外提供三层粒度以适配两种调用形态：

- **窗口天数常量** — 三端 + UI 文案共用，保证天数一致
- **窗口起点函数** — 桌面端 SQL 路径专用（数据库自行聚合，无法接受 JS 计数函数）
- **窗口计数函数** — `buildAnalysisData` 与移动端共用，保证边界符与过滤规则一致

桌面端保留 SQLite 聚合，不改为把全部记录读入内存计算 —— 那是不可逆的架构选择，与本任务目标无关。

移动端保留 `CalculateMetrics` 外壳而非改用 `BuildAnalysisData`：后者不含 `latestEndTime`（仍需保留循环，只能删一半），且其内部要建 24 槽 + 7 槽 + 月份 Map + 排序 durations，把它搬到每次渲染都跑的路径上，语义与性能双重错配。

## Decision (ADR-lite)

**Context**：同一统计语义存在三份独立实现、UI 文案独立手写，已实际发生两次漂移（口径漂移、时区漂移）。仅修复表象无法阻止复发。

**Decision**：
1. 口径统一为滚动窗口（近 7 天 / 近 30 天），「本月」概念从产品中移除
2. 窗口天数 + 起点 + 计数三层下沉 `packages/core`，UI 文案由常量渲染，使文案与实现在结构上无法漂移
3. 字段更名为 `Last7DayCount` / `Last30DayCount`，消除「月」的语义暗示 —— 口径改为滚动 30 天后，`FrequencyPerMonth` 会变得「差不多说得通」，该误导性名称将被本次修复顺手洗白、从此更难被发现
4. core 时区基准统一到本地（而非 UTC）：用户看的是自己墙上的钟；UTC 只在存储层有意义，而存储层已是 ISO UTC
5. 时区测试基建降级：钉 TZ 与辅助函数本地化保留（前者是改动读法的必要伴随成本，后者使回归保护免费获得），不新增专用跨时区回归用例 —— 该用例的边际价值不足以匹配其保护对象的真实使用率

**Consequences**：
- 老用户会看到「近 30 天」数值变大，月初尤其明显；仅通过卡片副标题「滚动窗口，非自然月」交代，不写 release notes
- `cross-env` 成为新的 devDependency
- 时区修复投入产出比偏低（保护一个近乎无人使用的功能），但改动本身近乎零成本，且 `packages/core` 是三端共享地基，未来若新增小时图表会直接继承该实现
- 「AI 分析是否值得保留」被识别为独立议题，本次不处理

## Out of Scope

- **不接入 CI** —— `npm run check` 仍只在开发者本机运行。这是两个缺陷得以长期存活的背景条件，但本次不处理
- **不新增环比指标**（如「较前 30 天 +3」）—— 需新增 `Prev*Count` 字段、三处实现各加计数器、测试再添一组，属加需求而非修缺陷
- **桌面端不改为内存计算** —— 保留 SQLite 聚合
- **月度趋势柱状图不动**（`database.ts:283` `GetMonthlyTrend`）—— 按自然月切分是正确的，且本来就是本地时区
- **不写 release notes**、不在界面上额外解释数值变化
- **不新增专用跨时区回归用例**
- **不讨论 AI 分析功能的存废**

## Technical Notes

### 关键文件

| 文件 | 涉及内容 |
|---|---|
| `packages/core/src/ai/buildAnalysisData.ts` | 时区基准 + 窗口计数，两个提交都会改到 |
| `packages/core/test/ai.test.ts` | 辅助函数本地化 + 断言对齐 |
| `packages/core/package.json` | test 脚本钉 TZ |
| `packages/shared/src/IRecord.ts` | `IStats` 字段重命名 |
| `packages/core/src/ai/ai.types.ts` | `IAiAnalysisData` 字段重命名 |
| `packages/core/src/ai/buildPrompt.ts` | 中文文案 |
| `packages/core/src/ai/analyzeLocally.ts` | 中文文案 |
| `src/main/database.ts` | `GetStats()` 窗口边界 |
| `src/renderer/views/StatsChart.tsx` | 两张 StatCard 文案 + state 初值 |
| `apps/mobile/app/(tabs)/stats.tsx` | `CalculateMetrics` 改调共享函数 + MetricTile 文案 |

### 约束

- 记录 `EndTime` 以 ISO UTC 字符串存于 SQLite TEXT 列（`database.ts:62,153`），本地窗口起点经 `toISOString()` 后与之做字典序比较是正确的，此处无需改动
- `packages/core` 测试用 `tsx` 直跑三个文件，无测试框架（`packages/core/package.json`）
- 钉 TZ 对 `prediction.test.ts` / `recordImportExport.test.ts` 同样有稳定性收益

### 需求收敛过程

本 PRD 由一次完整的 grilling 会话收敛而成，共 7 个决策点（口径语义 / 真相源位置 / 共享粒度 / 时区范围 / 字段命名 / 测试策略 / 文案措辞 / 提交拆分），每项均已确认。会话中修正过两处判断：一是「本周次数」并非撒谎（标题模糊但三方自洽），二是时区缺陷的严重度被高估（按错误程度而非曝光量排序）。
