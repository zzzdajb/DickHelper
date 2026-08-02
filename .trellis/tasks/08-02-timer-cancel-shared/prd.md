# 取消计时抽象到公共包，桌面端补齐

## Goal

移动端在 `7fb0d01` 加入了「取消本次计时」，桌面端没有。

但直接把那三行抄到桌面端是错的解法。真正的问题是：**`src/renderer/hooks/useTimer.ts` 和 `apps/mobile/src/hooks/useTimer.ts` 是两份几乎逐字相同的实现，且已经开始各走各的路** —— 移动端在最近两个任务里修掉的三个缺陷，桌面端一个都没有。再抄一次只会让下一个功能继续漏一端。

本任务把计时的**记账逻辑**（何时开始、暂停累计多久、本次用时多少）抽到 `packages/core`，两端各留一层薄的 React 对接层，然后桌面端补上取消出口。

## What I already know

### 现状（已逐处核实）

| 位置 | 事实 |
|---|---|
| `src/renderer/hooks/useTimer.ts:12-131` | 桌面端计时器。对外 `IsRecording` / `IsPaused` / `ElapsedSeconds` / `Start` / `Pause` / `Resume` / `Stop`，**无 `Cancel`** |
| `apps/mobile/src/hooks/useTimer.ts:37-156` | 移动端计时器。对外 `isRecording` / `isPaused` / `elapsedSeconds` / `start` / `pause` / `resume` / `stop` / `cancel`（**小写开头**） |
| 两份的算时长逻辑 | 完全等价：`(结束 - 开始 - 暂停累计) / 60000`，再 `Number(x.toFixed(2))`。**此公式不得改动**，历史数据依赖它 |
| 两份的内部状态 | 同样是 4 个：`startTimeRef` / `accumulatedPauseRef` / `lastPauseTimeRef` / `intervalRef` |
| `apps/mobile/src/hooks/useTimer.ts:101-110` | 移动端有 `ResetTimerState()` 单一清理路径，`stop()` 与 `cancel()` 共用 |
| `apps/mobile/src/hooks/useTimer.ts:1-18` | 移动端独有：`expo-keep-awake` 屏幕常亮，固定 tag `dickhelper-timer`，激活失败静默吞掉 |
| `src/renderer/views/RecordForm.tsx:24-138` | 桌面端记录页（Mantine）。`Group justify="center"` **横向**一行按钮 |
| `RecordForm.tsx:88-123` | 未计时：单个「开始」；计时中：「结束」（红、`variant="light"`）+「暂停/继续」 |
| `RecordForm.tsx:32-49` | `HandleStartStop` 一个函数兼管开始与结束，结束后**直接存库**并 `refresh()`，**无任何提示** |
| `RecordForm.tsx` 全文 | **没有任何消息提示机制**。`package.json` 也未安装 `@mantine/notifications` |
| `apps/mobile/app/(tabs)/index.tsx:161-163` | 移动端有 `Snackbar`，由 `message` 状态驱动，`duration={3000}` |
| `apps/mobile/app/(tabs)/index.tsx:222-225` | 取消按钮 `marginTop: 24`，叠加容器 `gap: 12` = 与主操作区实际间隔 36px |
| `packages/core/package.json` | **无 react 依赖**，纯 TS。`main` 直接指向 `./src/index.ts` |
| `packages/core/src/index.ts` | 全部为纯函数导出，无 class、无 React |
| `src/renderer/services/PredictionService.ts:2` | 渲染进程 import `@dickhelper/core` 已有先例，可行 |
| `package.json` `test:core` → `packages/core/package.json` `test` | 测试脚本是**手写串联**的 `tsx a.test.ts && tsx b.test.ts && ...`，新增测试文件必须手动加进这条链，否则永远不会被执行 |

### 桌面端现存的三个缺陷（移动端已修，桌面端未修）

| 缺陷 | 桌面端位置 | 后果 |
|---|---|---|
| `Start()` 未先清理上一个定时器 | `useTimer.ts:47-57` | 重复调用 `Start()` 会泄漏 interval。当前 UI 挡住了，是潜伏缺陷 |
| `updateElapsed` 无下限保护 | `useTimer.ts:32-44` | 系统时钟回跳时显示负秒数 |
| `Stop()` 在 `startTimeRef` 为 null 时未清零 `elapsedSeconds` | `useTimer.ts:83-88` | 异常路径留下残值 |

**分工修正（公共包落地后核实，与本文档初稿的说法不同）**：只有**缺陷二**由公共包的 `GetTimerElapsedSeconds` 下限保护直接覆盖。

**缺陷一和缺陷三必须由对接层主动解决** —— `StopTimer` 是纯函数，只返回结果、不返回新状态、不做任何清理。所以「结束后清零 `ElapsedSeconds`」和「开始前先清掉已有定时器」都是两端对接层各自的责任。**验收时不要误判这两条已由公共包覆盖。**

### 需求收敛结论（grilling 会话，8 项决策已确认）

1. **抽「记账」层，不抽 React 层。** 公共包只管：记住何时开始、暂停累计多久、当前是什么状态、本次用了多少秒。**公共包继续不依赖 React**（不加 react 依赖）。

   明确排除：只抽算式（最容易写错的「暂停时记时间点、继续时累加回去」那套仍会留两份，没解决问题）；整个 Hook 连 React 一起共享（公共包性质就变了，且要维护两端框架差异）。

2. **每秒刷新画面、屏幕常亮，留在各端对接层。** 定时器不进公共包 —— 否则测试要处理真实时间，两端还得接一套订阅机制。

3. **两端对外名字统一成大写开头。** 依据 `.trellis/spec/frontend/hook-guidelines.md:43`（"PascalCase because these are public API surface"）与全项目 C# 风格。桌面端合规，**移动端那份是偏离者，要改**。

   之所以现在改：两端对接层因为底层换成记账层而必须重写，统一命名的边际成本≈0。

4. **`hook-guidelines.md` 第 4 条自相矛盾，本任务顺手修掉。** 该行写「Return values are PascalCase for state flags, camelCase for functions」，与同文档第 43 行及其代码示例 `Start`/`Stop` 直接打架。

5. **桌面端取消做成低调纯文字按钮，放主按钮行下方并拉开间距，不弹确认框。**

   与移动端同一判断。也与桌面端现有风格一致 —— 「结束」本来就不确认、直接存库。

   后果：防误触全部防线在位置与视觉分量上，这不是样式偏好而是决策的必要配套。

6. **桌面端「结束」文案改为「结束并保存」。** 一旦出现「取消」，「结束」就产生歧义（用户会以为是「终止不保存」）。移动端已是此文案，两端统一。

7. **桌面端加一行提示文字，保存与取消两条路径都给反馈。** 不装新依赖（不引入 `@mantine/notifications`，为一个取消引入整套通知体系不值）。

   顺带补掉桌面端「存了但不告诉你」这个既有缺口 —— 这是本任务刻意接受的范围外收益。

8. **取消后清空备注框**，与移动端及「结束并保存」成功路径对称。心智模型：取消 = 这一次什么都不留。

### 明确不做（已确认排除，不要顺手做）

- 桌面端防息屏 / 屏幕常亮（移动端有，桌面端不补）。
- 睡眠或挂起导致时长虚高的兜底（"结束时刻减开始时刻"会把睡眠时间算进去，需求方明确表示不需要考虑）。
- 桌面端窗口最小化时秒数卡住（只影响显示，存库时长是准的）。
- 撤销 / 二次确认 / 倒计时反悔窗口。

## Requirements

### 一、新增 `packages/core/src/timer/`

设计为**纯函数 + 不可变状态**，与 `packages/core` 现有风格一致（无 class、无副作用、时间由参数注入）。

1. 状态类型只含三个字段，`isRecording` / `isPaused` 均由其派生，不单独存：

```typescript
export interface ITimerState {
    readonly StartedAtMs: number | null;
    readonly AccumulatedPauseMs: number;
    readonly PausedAtMs: number | null;
}
```

2. 本次结果类型（**注意大写开头**，与决策 3 一致）：

```typescript
export interface ITimerSession {
    readonly StartTime: Date;
    readonly EndTime: Date;
    readonly DurationMinutes: number;
}
```

3. 导出以下内容。所有需要「现在」的函数一律**以参数接收 `nowMs: number`**，不在公共包内部调用 `Date.now()` —— 这是这一层可被纯测试覆盖的前提：

| 导出 | 行为 |
|---|---|
| `IDLE_TIMER_STATE` | 未开始的状态常量 |
| `StartTimer(nowMs)` | 返回全新的运行中状态 |
| `PauseTimer(state, nowMs)` | 未运行或已暂停时**原样返回**，不抛错 |
| `ResumeTimer(state, nowMs)` | 未运行或未暂停时**原样返回**，不抛错；把本次暂停时长累加进 `AccumulatedPauseMs` |
| `StopTimer(state, nowMs)` | 未开始时返回 `null`；否则返回 `ITimerSession` |
| `GetTimerElapsedSeconds(state, nowMs)` | 已扣除暂停；**带下限 0 保护**（覆盖桌面端缺陷二） |
| `IsTimerRunning(state)` | `StartedAtMs !== null` |
| `IsTimerPaused(state)` | `PausedAtMs !== null` |

   取消不需要独立函数 —— 取消就是「把状态换回 `IDLE_TIMER_STATE` 且不取结果」，由对接层完成。

4. 时长公式与两端现状**逐字保持一致**，不得"顺手优化"：

```typescript
Number(((endMs - startMs - totalPausedMs) / 60_000).toFixed(2))
```

   `StopTimer` 计算总暂停时长时，必须把「停止时仍处于暂停中」这段也算进去（两端现状均如此）。

5. 通过 `packages/core/src/timer/index.ts` 与 `packages/core/src/index.ts` 导出。

6. 新增 `packages/core/test/timer.test.ts`，沿用现有测试文件的写法（`RunTest` + `node:assert`）。必须覆盖：
   - 正常开始→结束的时长
   - 单次暂停、多次暂停的扣除
   - 停止时仍在暂停中
   - 未开始时 `StopTimer` 返回 `null`
   - `PauseTimer` / `ResumeTimer` 在非法状态下原样返回
   - 时钟回跳时 `GetTimerElapsedSeconds` 返回 0 而非负数。

     **措辞修正**：暂停期间发生回跳时下限保护其实并不参与 —— 展开公式后 `now` 自然相消，暂停期间的已用秒数恒等于暂停那一刻的值，回跳多远都不会变负。下限真正拦住的是另两种：「运行中回跳」和「暂停期间回跳导致暂停累计超过墙上时间」。三种都要有断言。

7. **把新测试文件加进 `packages/core/package.json` 的 `test` 脚本串联链**，否则它永远不会被执行。

### 二、重写 `src/renderer/hooks/useTimer.ts`

8. 内部改为持有 `ITimerState`，全部时间计算委托给公共包，**桌面端不再自己算时长**。

9. 对外契约（`Cancel` 为新增，其余名字不变，桌面端调用方无需改名）：

```typescript
IsRecording: boolean;
IsPaused: boolean;
ElapsedSeconds: number;
Start: () => void;
Pause: () => void;
Resume: () => void;
Stop: () => ITimerSession | null;
Cancel: () => void;
```

10. `Stop` 的返回类型从内联的 `{ startTime; endTime; durationMinutes }` 改为公共包的 `ITimerSession`（**字段名随之变成大写开头**），`RecordForm.tsx` 的取值处要同步改。

11. `Start` 必须先清理已有定时器（覆盖桌面端缺陷一）。

12. 结束与取消走**同一条清理路径**，`ElapsedSeconds` 一并清零（覆盖桌面端缺陷三）。

13. 未在计时中调用 `Cancel` 必须是安全空操作。

### 三、重写 `apps/mobile/src/hooks/useTimer.ts`

14. 同样改为持有 `ITimerState`，计算委托公共包。

15. **对外名字全部改成大写开头**，与桌面端一致：`IsRecording` / `IsPaused` / `ElapsedSeconds` / `Start` / `Pause` / `Resume` / `Stop` / `Cancel`。`ITimerStopResult` 由公共包的 `ITimerSession` 取代。

16. **屏幕常亮必须保留，且行为不变**：`Start` 激活，任何终止动作（`Stop` / `Cancel` / 组件卸载）释放，固定 tag `dickhelper-timer`，激活/释放失败静默吞掉。

    这是编译期发现不了的陷阱 —— 漏一条路径，屏幕会一直亮到 App 退出。

17. 同步改 `apps/mobile/app/(tabs)/index.tsx` 的全部调用点（`timer.isRecording` → `timer.IsRecording` 等，约 15 处），以及 `result.startTime` → `result.StartTime` 等取值处。**界面外观与交互不得有任何变化。**

### 四、桌面端 `src/renderer/views/RecordForm.tsx`

18. 主按钮计时中文案 `结束` → `结束并保存`。

19. 计时中，在按钮行**下方**新增取消按钮：
    - Mantine `variant="subtle"`，`size="sm"`，`color="gray"`
    - 文案「取消本次计时」
    - 与按钮行拉开明显间距（约 24–32px），视觉上一眼读作次要操作
    - **不弹确认框**
    - 未计时时不渲染

20. 新增一行提示文字（`Text size="sm"`，居中，位置在按钮区与备注框之间），由一个消息状态驱动：
    - 保存成功 → 「记录已保存」
    - 取消 → 「已取消，本次未保存」
    - 保存失败 → 显示失败原因（当前 `HandleStartStop` 的 `.then()` 无错误分支，需补上）
    - 再次点「开始」时清空

21. 取消处理：调用 `Cancel()`，清空备注，设置提示文字。**不写库、不 `refresh()`。**

22. 现有「暂停/继续」行为与样式不变。

### 五、规范文档

23. 更新 `.trellis/spec/frontend/hook-guidelines.md` 的 `useTimer` 小节：补 `Cancel`，把返回类型改为 `ITimerSession`，说明记账逻辑已在 `packages/core`，并注明两端对外契约一致。

24. 修掉同文档 `## Hook Rules` 第 4 条与第 43 行及代码示例的自相矛盾（统一为：对外返回的状态与方法一律 PascalCase）。

### 六、需求方追加裁决项（实现与自检完成后追加）

前五节落地后，需求方复核代码时发现四处「靠人自觉」的软约束，追加为硬要求。共同点：这四处原先都只是注释或惯例，typecheck 与 lint 一个都拦不住。

25. **`IUseTimerResult` 收成单一来源。** 两端各自手写了一份逐字相同的 `IUseTimerResult`，只靠「改一端必须同时改另一端」的注释约束 —— 这正是本任务想消灭的机制，只是从底层挪到了上层。改为两端 import 同一个类型声明，任一端少实现一个成员即 typecheck 报错。

    落点为 `packages/core/src/timer/timer.types.ts`，紧邻 `ITimerSession`。**不能放 `packages/shared`**：`packages/shared` 无任何依赖、`packages/core` 依赖 `packages/shared`，而本类型引用了 `ITimerSession`，挪去 shared 即形成 `shared ↔ core` 循环依赖。类型本身只有布尔、数字与函数签名，不含 React 依赖，不破坏 core 的纯净；core 已有 `ai.types.ts` / `prediction.types.ts` 存放两端共同消费类型的先例。

    配套：从 `packages/core/src/index.ts` 导出；两端删掉本地那份；两端 hook 返回值显式标注为该类型；两处「改一端必须同时改另一端」的注释换成「契约已单一来源，此处无需人工同步」。

26. **桌面端取消按钮的防误触间距钉死在按钮自身。** 原实现的 30px 间距 = 外层 `Stack gap="lg"`（20px）+ 按钮 `mt="xs"`（10px），将来谁调小外层 `gap`，这段唯一防线会静默缩水。改为 `mt="xl"`（Mantine 7 默认 spacing `xl`，已核实 `default-theme.cjs` 为 `rem(32)` 即 32px，且 `App.tsx` 的 `createTheme` 未覆写 `spacing`），使间距不再依赖外层容器。仍用主题令牌，不写死数字。按钮处注释需注明：这是防误触唯一防线、刻意不依赖外层 `gap`、不要改小。

27. **lint 脚本补上 `src/renderer`。** 根 `package.json` 的 lint 范围是 `src/main src/preload packages apps/mobile` —— 整个 `src/renderer`（19 个文件，含刚重写的 hook）从未被 lint 检查过，`react-hooks` 规则也从未生效。补入后实测零 error 零 warning，是零成本。

28. **桌面端提示文字 3 秒自动消失，且不让界面跳动。** 与移动端 `Snackbar` 的 `duration={3000}` 对称。两件必须一起做：

    - 用 `messageTimeoutRef` 承载定时器。**每次设新消息必须先清掉上一条未触发的 timeout**，否则前一条的定时器会把刚设的这条提前抹掉；组件卸载时也要清（`useEffect` 空依赖数组 + 内联清理，与 `useTimer` 同一写法）。
    - **提示行始终渲染并占住一行高度**。它是内联文字而非浮层，出现与消失都会把下方备注框顶动一行，叠加自动消失就是跳两次。无消息时填不换行空格（`NBSP` 常量，写成 `"\u00A0"` 转义以免源码里出现看不见的字符；普通空格会被 HTML 折叠、撑不出高度），高度由字体自身算出，不写死像素。

## Acceptance

- `npm run check` 全绿（typecheck 三个 + lint + core 测试 + mobile export）。
- `IUseTimerResult` 在 `packages/core/src/timer/timer.types.ts` 唯一声明，两端均无本地副本。
- 实测反证：从任一端 hook 的返回对象里删掉 `Cancel`，`typecheck` 报 `TS2741: Property 'Cancel' is missing ... but required in type 'IUseTimerResult'`。
- `npm run lint` 的范围包含 `src/renderer`。
- 桌面端提示文字 3 秒后自动消失，出现与消失均不引起下方备注框位移。
- `packages/core/test/timer.test.ts` 确实被 `npm run test:core` 执行到（不是加了文件却没进串联链）。
- 桌面端与移动端**除桌面端新增的取消按钮、提示文字、按钮文案外，界面无其他变化**。
- 两端 `useTimer` 内均不再出现 `/ 60_000`、`/ (1000 * 60)` 之类的时长计算 —— 全部委托公共包。
- 移动端屏幕常亮在 `Stop` / `Cancel` / 卸载三条路径上都释放。
