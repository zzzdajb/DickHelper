# 计时期间允许取消

## Goal

移动端计时一旦开始，只有「结束并保存」一条出路。误触开始、或本次记录不作数时，用户只能被迫存一条垃圾记录再去历史页删掉。

本任务在计时进行中提供「取消」出口：丢弃本次计时，不写入任何数据。

这是「移动端三改动」系列的第二项。第一项 `计时期间屏幕常亮` 已完成（commit `e37a3b1`）。第三项 `黑夜模式` 会重写全部界面配色，刻意排在本任务之后 —— 本任务要改动记录页的按钮布局，先做黑夜模式等于给记录页配两遍色。

## What I already know

### 现状（已逐处核实）

| 位置 | 事实 |
|---|---|
| `apps/mobile/src/hooks/useTimer.ts` | 计时状态机。对外暴露 `start` / `pause` / `resume` / `stop` 与 `isRecording` / `isPaused` / `elapsedSeconds` |
| `useTimer.ts` `stop()` | 返回 `ITimerStopResult \| null`，重置全部内部 ref 与 state，并释放屏幕常亮 |
| `useTimer.ts` `ReleaseKeepAwake()` | 上一个任务引入，`stop()` 与 Hook 卸载时调用 |
| `apps/mobile/app/(tabs)/index.tsx:94-132` | `styles.actions` 是一个 `gap: 12` 的 `View`，未设 `flexDirection`，因此按钮**竖向排列** |
| `index.tsx:95-131` | 未计时时只渲染「开始」；计时中渲染「暂停/继续」（outlined）+「结束并保存」（contained，红色底） |
| `index.tsx:46-69` | `HandleStop` 调 `timer.stop()`，成功后 `setNotes("")` 并提示「记录已保存」 |
| `index.tsx:145-147` | 已有 `Snackbar`，由 `message` 状态驱动，`duration={3000}` |
| `index.tsx:12` | `notes` 状态在记录页组件内 |

### 需求收敛结论（grilling 会话，3 项决策已确认）

1. **不做二次确认** —— 点击即丢弃，不弹确认框、不提供撤销窗口。

   需求方明确选择了此项（我原本推荐弹确认框）。后果是**防误触的全部防线转移到按钮的位置与视觉分量上**，因此第 2 条不是可选的样式偏好，而是本决策的必要配套。

2. **取消做成低调的文字按钮，放在两个主按钮下方并拉开间距** —— 无实心背景、字号小、离「结束并保存」最远。视觉上必须一眼读作「次要操作」。

   明确排除的方案：三个同宽实心按钮平级竖排（取消与保存同等分量且紧邻，在无确认框的前提下误触代价最高）；计时圆盘角上的叉号（语义歧义 —— 关页面？清零？）。

3. **取消后清空备注框，并提示「已取消，本次未保存」**。

   清空备注：与「结束并保存」成功后的行为对称，心智模型统一为「取消 = 这一次什么都不留」。

   必须给提示：因为没有确认框，用户需要一个明确信号确认自己点中了、且知道发生了什么。

### 与上一个任务的耦合

`stop()` 目前承担了三件事：算出本次结果、重置状态机、释放屏幕常亮。取消需要后两件而不需要第一件。实现时必须保证**取消路径同样释放屏幕常亮** —— 否则计时被取消后屏幕会一直亮着直到 App 退出，这是上一个任务留下的、编译期无法发现的陷阱。

## Requirements

### 一、`apps/mobile/src/hooks/useTimer.ts`

1. 在 `IUseTimerResult` 中新增 `cancel: () => void`，并实现之。

2. `cancel()` 的行为：停止计时、释放屏幕常亮、把所有内部 ref 与 state 重置回未开始状态、**不返回任何结果**。等价于 `stop()` 除「计算并返回 `ITimerStopResult`」之外的全部副作用。

3. 未在计时中时调用 `cancel()` 必须是安全的空操作，不得抛错。

4. `stop()` 与 `pause()` / `resume()` 的现有行为不得改变。

5. `stop()` 与 `cancel()` 之间的状态重置逻辑重复（两者都要重置 4 个 ref/state + 释放常亮）。**允许提取一个私有的重置函数供两者复用** —— 这是同一份重置逻辑的第二个调用点，且重复的是「必须保持一致」的状态清理，漏改一处就是状态残留 bug。但**不要**为此引入更大的抽象。

### 二、`apps/mobile/app/(tabs)/index.tsx`

6. 计时进行中（`isRecording` 为 true，含 `isPaused` 为 true 的暂停态）时，在「暂停/继续」与「结束并保存」**下方**渲染取消按钮。

7. 取消按钮的形态：react-native-paper `Button` 的 `mode="text"`，不设 `buttonColor`，文案「取消本次计时」。**必须与上方两个主按钮之间留出明显大于 `styles.actions` 现有 `gap: 12` 的垂直间距**，使其在视觉上脱离主操作区。

8. 取消按钮在保存进行中（`saving` 为 true）时禁用，与「结束并保存」的 `disabled` 条件一致，避免保存过程中被取消导致状态竞争。

9. 点击处理：调用 `timer.cancel()` → `setNotes("")` → `setMessage("已取消，本次未保存")`。**不得**调用任何数据库方法。

10. 未开始计时时不渲染取消按钮。

### 三、通用

11. 代码遵循 `.trellis/spec/frontend/code-style.md`：事件处理器用 `Handle` 前缀、显式返回类型、不做超出任务范围的抽象。

12. 本任务**不引入任何新的写死颜色值** —— 下一个任务（黑夜模式）要清除记录页全部硬编码颜色，此处新增等于给自己埋工作量。取消按钮不指定颜色，让 Paper 主题接管。

## Acceptance Criteria

- [ ] `npm run check` 全绿（typecheck ×3 + lint + test:core + mobile:export），退出码 0
- [ ] `IUseTimerResult` 暴露 `cancel`
- [ ] `cancel()` 释放了屏幕常亮 —— 取消后屏幕不会持续常亮
- [ ] `cancel()` 重置的 ref/state 与 `stop()` 完全一致（`isRecording` / `isPaused` / `elapsedSeconds` / `startTimeRef` / `accumulatedPauseRef` / `lastPauseTimeRef` / interval）
- [ ] 未计时时调用 `cancel()` 不抛错
- [ ] `stop()` 的返回值契约与既有行为未改变
- [ ] 取消路径不触达 `useMobileDatabaseService` 的任何方法
- [ ] 取消按钮为 `mode="text"`，位于两个主按钮下方，间距明显大于 12
- [ ] 取消按钮在 `saving` 时禁用
- [ ] 暂停状态下取消按钮依然可见可点
- [ ] `git diff` 中记录页**无新增硬编码颜色值**（`#rrggbb` 字面量）

**已知无法在本环境验证的部分**：按钮实际的视觉分量与误触难度需真机确认。经与需求方确认，本轮不做专门验收。

## Definition of Done

- `npm run check` 本机通过
- lint / typecheck 全绿
- commit message 使用中文，遵循 `docs/commit-convention.md`
- 无需 docs 更新

## Technical Approach

`cancel` 落在 `useTimer` 内部而非记录页组件：计时状态机的所有 ref 都是 Hook 私有的，外部无法重置；且屏幕常亮的释放也在 Hook 内。取消必须是状态机自己的一个动作。

不把 `cancel` 实现为「调 `stop()` 然后丢弃返回值」：语义上说得通，但 `stop()` 会执行 `durationMinutes` 的计算与 `Number(...toFixed(2))`，是取消不需要的工作；更重要的是这会让两个动作在代码上纠缠，将来 `stop()` 增加任何「保存前的准备工作」都会被取消路径意外继承。

不为取消引入确认状态或撤销缓冲：需求方明确拒绝了这两种交互。

## Decision (ADR-lite)

**Context**：计时一旦开始只有保存一条出路，误触成本高。

**Decision**：
1. 取消 = 立即丢弃，无确认框、无撤销窗口
2. 防误触完全依赖按钮位置与视觉分量：文字按钮、置于主操作下方、拉开间距
3. 取消后清空备注并给出明确提示
4. `cancel` 作为 `useTimer` 的一个独立动作实现，不复用 `stop()`
5. 允许在 `stop` / `cancel` 之间提取共享的状态重置逻辑（第二个调用点，且重复的是必须一致的清理）

**Consequences**：
- 误触取消将直接丢失本次计时，无任何补救。这是需求方已知并接受的取舍
- 上述防线是纯视觉的，无编译期或测试期保护。将来任何人把取消按钮改成实心、或挪回主按钮区，防线即失效且不会有任何告警
- 记录页按钮区高度增加，下一个任务（黑夜模式）需为这个最终形态配色

## Out of Scope

- **不做二次确认框**、不做撤销
- **不做取消原因记录**、不做「已取消次数」统计
- **不改动 `stop()` / `pause()` / `resume()` 的现有行为**
- **不处理计时状态持久化** —— App 被杀掉，进行中的计时依然丢失。既有问题，与本任务无关
- **不做任何配色改动** —— 属于下一个任务
- **不碰桌面端、`packages/core`、`packages/shared`**
- **不做真机验收**

## Technical Notes

### 关键文件

| 文件 | 涉及内容 |
|---|---|
| `apps/mobile/src/hooks/useTimer.ts` | 新增 `cancel` 动作，可能提取共享重置逻辑 |
| `apps/mobile/app/(tabs)/index.tsx` | 新增取消按钮与其点击处理 |

### 约束

- 记录页当前 6 处硬编码颜色将在下一个任务统一清理，本任务不得增加新的
- `packages/core` 是纯数据逻辑包，计时交互逻辑不得下沉
- 屏幕常亮的释放是上一个任务引入的隐性契约，任何新增的「终止计时」路径都必须释放

### 需求收敛过程

本 PRD 由一次完整的 grilling 会话收敛而成。本任务对应其中 3 个决策点（是否二次确认 / 按钮形态与位置 / 取消后的收尾行为），均已与需求方确认。会话中我推荐弹确认框，需求方选择了不拦截；据此把按钮的位置与视觉分量从「样式偏好」提升为「决策的必要配套」，并在 Consequences 中记录了该防线无自动化保护这一风险。
