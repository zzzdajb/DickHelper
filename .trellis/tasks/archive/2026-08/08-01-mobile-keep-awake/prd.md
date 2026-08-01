# 计时期间屏幕常亮

## Goal

移动端计时进行中，屏幕会按系统超时自动熄灭。用户在计时期间通常不会持续触摸屏幕，熄屏后既看不到当前用时，恢复时还要解锁，体验割裂。

本任务让计时器处于活动状态期间保持屏幕常亮，计时结束或取消后立即释放。

这是「移动端三改动」系列的第一项，后两项为 `计时期间允许取消`（会改动记录页按钮布局）与 `黑夜模式`（会重写全部界面配色）。执行顺序刻意定为 常亮 → 取消 → 黑夜模式：后者需要给最终形态的记录页配色，先做黑夜模式等于给记录页配两遍。

## What I already know

### 现状（已逐处核实）

| 位置 | 事实 |
|---|---|
| `apps/mobile/src/hooks/useTimer.ts` | 计时状态机所在。`start` / `pause` / `resume` / `stop` 四个动作，`isRecording` + `isPaused` 两个状态位 |
| `apps/mobile/app/(tabs)/index.tsx:11` | `useTimer()` 目前仅被记录页单独调用，状态不出该组件 |
| `apps/mobile/package.json` | 未声明 `expo-keep-awake` |
| `node_modules/expo-keep-awake/package.json` | 版本 `56.0.3` 已随 `expo` 传递安装，与 `expo ~56.0.4` 同代 |
| `node_modules/expo-keep-awake/android/src/main/java/expo/modules/keepawake/ExpoKeepAwakeManager.kt` | 实现为 `activity.window.addFlags(FLAG_KEEP_SCREEN_ON)` / `clearFlags` |
| `node_modules/expo-keep-awake/android/src/main/AndroidManifest.xml` | 不声明任何权限 |

`FLAG_KEEP_SCREEN_ON` 是窗口标志而非 wake lock，因此：**不需要 `WAKE_LOCK` 权限、不需要 config plugin 改 `AndroidManifest.xml`、不需要在 `app.json` 的 `plugins` 数组注册**。Expo autolinking 会在 `expo prebuild` 时自动链接该原生模块，唯一要做的是把它列为 `apps/mobile` 的直接依赖。

`ExpoKeepAwakeManager` 内部用 tag 集合计数，重复 `activate` 同一 tag 是幂等的，`deactivate` 一个从未激活的 tag 也不会抛错。

### 需求收敛结论（grilling 会话，3 项决策已确认）

1. **覆盖范围** — 从点「开始」到「结束 / 取消」的整段，**包含暂停状态**，且**与当前所处页面无关**（计时中切到统计页翻数据，屏幕依然常亮）。

   选择包含暂停而非「仅记录中」：规则简单、与「计时期间」的字面语义一致；且暂停后熄屏会导致用户回来点「继续」前必须先解锁，多一步操作，收益（省电）不抵成本。

2. **不提供开关，不显示提示文字** — 常亮只在计时这段有明确边界的时间内生效，不是常驻耗电行为，不值得为它增加一个设置项 + 一份需异步读取的偏好 + 一条需验证的分支。将来收到真实抱怨再加。

3. **常亮跟随计时状态，不跟随组件挂载** — 用命令式 API 在 `start` 时激活、在 `stop` 时释放，而不是用 `useKeepAwake()` 这个挂载即生效的 Hook。

   理由：`useKeepAwake()` 的生效范围等于调用它的组件的挂载周期。当前 `expo-router` 的 Tabs 在页面被访问后默认保持挂载，所以 Hook 写法**碰巧**能满足「切到统计页仍常亮」；但这是对导航库卸载策略的隐性依赖，一旦将来开启页面卸载或改变导航结构，常亮会静默失效且无任何编译期信号。命令式写法把常亮的生命周期显式绑定到计时状态，与需求一一对应。

### 后台行为（无需额外处理）

`FLAG_KEEP_SCREEN_ON` 仅在 Activity 处于前台时生效，切后台自动失效、回前台自动恢复（标志仍在 window 上）。计时时长本身由 `startTime` 实时反算而非累加，`setInterval` 在后台被系统节流也不会导致读数错误。

## Requirements

1. 在 `apps/mobile/package.json` 的 `dependencies` 中声明 `expo-keep-awake`，版本与 `node_modules` 中已安装的 `~56.0.3` 一致（与 `expo ~56.0.4` 同代）。**不改 `app.json`，不加 config plugin，不加权限。**

2. 在 `useTimer` 内部完成激活与释放，使常亮成为计时状态机的一部分，调用方（记录页）无需感知：

   - `start()` 成功启动计时后激活常亮
   - `stop()` 结束计时后释放常亮 —— 包含 `startTimeRef` 为 `null` 的提前返回分支，该分支同样必须释放
   - Hook 卸载时（现有的 `useEffect` 清理函数）释放常亮，避免组件意外卸载后标志残留
   - `pause()` / `resume()` **不触碰**常亮状态

3. 使用固定的 tag 字符串标识本应用的常亮申请，避免与库的默认 tag 混淆。

4. 激活 / 释放的调用失败不得中断计时。屏幕常亮是锦上添花，其失败不应让用户无法开始或结束一次记录 —— 按 `.trellis/spec/frontend/quality-guidelines.md` 的错误处理约定处理，不向用户弹错误提示。

5. 代码遵循 `.trellis/spec/frontend/code-style.md`：显式返回类型、`Handle` 前缀仅用于事件处理器、不做超出任务范围的抽象。

## Acceptance Criteria

- [ ] `npm run check` 全绿（typecheck ×3 + lint + test:core + mobile:export），退出码 0
- [ ] `expo-keep-awake` 出现在 `apps/mobile/package.json` 的 `dependencies` 中
- [ ] `app.json` 无改动（既不增加 plugin，也不增加 permission）
- [ ] `AndroidManifest.xml` 相关的 config plugin 无新增
- [ ] `useTimer` 的 `stop()` 两条返回路径（正常结束 / `startTimeRef` 为 `null` 的提前返回）都释放了常亮
- [ ] `pause()` / `resume()` 不包含任何常亮相关调用
- [ ] `apps/mobile/app/(tabs)/index.tsx` 除必要外无改动 —— 常亮逻辑不泄漏到界面层
- [ ] 常亮的激活 / 释放失败不会向上抛出，不会阻断 `start` / `stop`

**已知无法在本环境验证的部分**：屏幕是否真的不熄灭，必须真机确认（模拟器屏幕不会真实休眠）。经与需求方确认，本轮不做专门验收，发现问题再修。

## Definition of Done

- `npm run check` 本机通过
- lint / typecheck 全绿
- commit message 使用中文，遵循 `docs/commit-convention.md`
- 无需 docs 更新

## Technical Approach

常亮的生命周期与 `useTimer` 的计时生命周期完全重合，因此实现落在 `useTimer` 内部，而非记录页组件或新建独立 Hook。

不新建 `useKeepAwakeDuringTimer` 之类的包装 Hook：按 `.trellis/spec/frontend/code-style.md` 的「三行相似代码优于一次过早抽象」原则，此处只有一个调用方、逻辑仅两次调用，包装一层只会增加读者的跳转成本。

不把计时状态提升为全局 Context：需求「切页面仍常亮」已由命令式 API 天然满足（常亮绑定 Activity 窗口而非 React 组件树），状态提升是不必要的架构改动。

## Decision (ADR-lite)

**Context**：需求为「计时期间屏幕常亮」，其中「计时期间」跨越暂停状态与页面切换。

**Decision**：
1. 常亮范围 = 计时器活动的整段（含暂停），与页面无关
2. 无用户开关、无界面提示
3. 用命令式 API 绑定计时状态，而非 `useKeepAwake()` 绑定组件挂载
4. 实现内聚在 `useTimer`，不外溢到界面层
5. 常亮失败静默降级，不阻断计时

**Consequences**：
- 用户暂停后忘记结束，屏幕会持续常亮直至熄屏以外的方式退出。已知并接受 —— 这是「规则简单」的代价
- `apps/mobile` 新增一个直接依赖（该包已在 `node_modules` 中，不引入新的下载体积）
- 常亮无法通过 `npm run check` 验证，只能真机确认

## Out of Scope

- **不做用户开关**，不加设置项
- **不做界面提示文字** —— 记录页 UI 不因本任务改动
- **不处理计时状态持久化** —— App 被杀掉，进行中的计时依然会丢失。这是既有问题，与本任务无关
- **不改动 `pause` / `resume` 的任何现有行为**
- **不碰桌面端、不碰 `packages/core` 与 `packages/shared`**
- **不做真机验收** —— 经确认本轮不专门验证

## Technical Notes

### 关键文件

| 文件 | 涉及内容 |
|---|---|
| `apps/mobile/package.json` | 新增 `expo-keep-awake` 直接依赖 |
| `apps/mobile/src/hooks/useTimer.ts` | 常亮的激活与释放，唯一的逻辑改动点 |

### 约束

- `apps/mobile/android/` 已被 gitignore，是 `expo prebuild` 的产物，CI 会重新生成 —— 因此**任何手改原生目录的方案都不可接受**。本任务恰好不需要触碰原生层
- `packages/core` 是纯数据逻辑包，React Native 专有的常亮逻辑**不得**下沉到那里
- 参见 `.trellis/spec/frontend/mobile-implementation.md` 的 Expo Config Plugins 一节 —— 本任务确认无需 plugin，但后续「黑夜模式」任务需要

### 需求收敛过程

本 PRD 由一次完整的 grilling 会话收敛而成。会话覆盖三个改动共 10 个决策点，本任务对应其中 3 个（覆盖范围 / 是否可开关 / 绑定对象），均已与需求方确认。会话中通过读取 `expo-keep-awake` 的 Kotlin 实现，排除了「需要新增 Android 权限」这一常见误判。
