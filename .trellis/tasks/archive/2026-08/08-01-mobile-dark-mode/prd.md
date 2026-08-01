# 移动端黑夜模式

## Goal

移动端只有一套写死的浅色主题，`app.json` 还显式锁死 `userInterfaceStyle: "light"`。系统切换到深色时，App 依然刺眼。

本任务让移动端跟随系统深浅色自动切换，并把散落在 6 个界面的约 80 处硬编码颜色收敛为主题令牌。

这是「移动端三改动」系列的第三项，也是最后一项。前两项已完成：`计时期间屏幕常亮`（`e37a3b1`）、`计时期间允许取消`（`7fb0d01`）。本任务刻意排在最后 —— 前两项改动了记录页的按钮布局，先做本任务等于给记录页配两遍色。

## What I already know

### 现状（已逐处核实）

| 位置 | 事实 |
|---|---|
| `apps/mobile/src/theme.ts` | 唯一主题，基于 `MD3LightTheme` 覆盖 9 个颜色，导出为常量 `appTheme` |
| `apps/mobile/app.json:11` | `"userInterfaceStyle": "light"` —— 显式锁死浅色，不改这里系统深色信号根本传不进来 |
| `apps/mobile/app/_layout.tsx:42` | `<PaperProvider theme={appTheme}>` —— 静态传入 |
| `apps/mobile/app/_layout.tsx:43` | `<StatusBar style="dark" />` —— 状态栏文字颜色写死深色 |
| `apps/mobile/app/_layout.tsx:51` | `Stack` 的 `contentStyle.backgroundColor` 静态引用 `appTheme` |
| `apps/mobile/app/_layout.tsx:68,76,80` | `styles.root` / `loadingContainer` / `loadingText` 在 `StyleSheet.create` 中静态引用 `appTheme` |
| `apps/mobile/app/(tabs)/_layout.tsx` | **整个文件静态 import `appTheme`**，header 背景、tabBar 背景、选中/未选中色、分隔线全部取自它 |
| 6 个界面文件 | 共约 80 处 `#rrggbb` 字面量，全部写在文件底部的 `StyleSheet.create` 中 |
| 全部界面 | **无任何图表库**，纯文字 + `Surface` 卡片。深色改造不涉及数据可视化配色 |
| `apps/mobile/android/` | 已 gitignore，是 `expo prebuild` 产物。`.trellis/spec/frontend/mobile-implementation.md` 明确记载 CI 会重新生成 —— **任何手改原生目录的方案都不可接受** |
| `android/app/src/main/res/values/styles.xml` | 父主题已是 `Theme.AppCompat.DayNight.NoActionBar`，`android:windowBackground` 指向 `@color/activityBackground` |
| `android/app/src/main/res/values/colors.xml` | `splashscreen_background` `#FFFFFF`、`activityBackground` `#f8fafc`，**无 `values-night`** |
| `apps/mobile/plugins/withCleartextTraffic.js` | 既有 config plugin 先例，模式可照抄 |
| `eslint.config.js` | 扁平配置，可直接追加一个按 `files` 限定作用域的规则块 |

### 关键结论

**启动白闪确认存在**：`splashscreen_background` 与 `activityBackground` 都只有浅色一份，系统深色下开 App 会先白闪一帧。因为原生父主题已是 DayNight，只要补一份 `values-night` 颜色资源即可自动生效 —— 而这必须通过 config plugin 完成，不能手改。`expo/config-plugins` 已导出 `withAndroidColorsNight`（已验证）。

**`(tabs)/_layout.tsx` 是最容易漏的一处**：它不像界面文件那样有大量 `#rrggbb` 字面量（一处都没有），但它静态引用了浅色主题常量。**不改这个文件，深色模式下底部 Tab 栏和顶部导航栏会永远保持浅色**，而任何自动检查都发现不了。

**`styles.root` 在主题作用域之外**：`GestureHandlerRootView` 是 `PaperProvider` 的父级，无法用 `useTheme()`，必须直接读系统深浅色。

### 需求收敛结论（grilling 会话，4 项决策已确认）

1. **只跟随系统，不提供任何开关**。理由：现有偏好存于 SQLite 键值表、读取是异步的，手动开关会导致启动时先按默认主题渲染再切换（闪一下）；跟随系统则可同步读取，无此问题。
2. **深色沿用现有冷灰（slate）风格反向配置**，不用 Paper 自带的 `MD3DarkTheme`（其底色带紫调，与现有 slate + teal 风格割裂），也不用 Material You 动态取色（每台设备不同，无法保证对比度也无法验收）。
3. **6 个界面的样式表全部改成「吃进主题后算出来」**，而非保留静态样式表在用处内联覆盖。理由：颜色继续集中在一处，6 个文件同一套改法，新加界面照抄即可；内联覆盖会让颜色散落进 JSX，将来新增 UI 极易漏写。
4. **加一道自动检查禁止手机端硬编码颜色，并入 `npm run check`**。理由见下。

### 为什么必须加这道检查

需求方明确选择了「不专门跑 App 验收，发现问题再修」。这类横扫式配色改造最典型的失败不是写错，而是**漏改** —— 某个界面底部残留一行 `#ffffff`，深色下就是一块白板。它是完全合法的字符串字面量，typecheck、lint、现有测试全都拦不住。

这道规则把「漏改」这一主要风险变成编译期可捕获，且不需要模拟器或真机。它拦不住「改错」（例如把描边色错配成文字色），后者仍需真机确认 —— 这一残余风险需求方已知并接受。

## Requirements

### 一、`apps/mobile/src/theme.ts` —— 主题基础设施

1. 导出浅色与深色两套 `MD3Theme`。浅色主题的**所有现有颜色值保持不变**，仅新增下方映射表要求的令牌。

2. MD3 标准色槽之外，需要三个自定义令牌：`textBody`、`textMuted`、`success`。通过扩展主题类型实现（`MD3Theme & { colors: MD3Theme["colors"] & { ... } }`），并导出一个类型化的 `useAppTheme()` 供界面调用，使自定义令牌具备类型提示。

3. 完整颜色映射表 —— **这是本任务的单一真相源，所有界面必须严格按此替换**：

   | 现有硬编码值 | 用途 | 主题令牌 | 浅色值（不变） | 深色值 |
   |---|---|---|---|---|
   | `#0f766e` | 主色：页面标题、计时数字、强调 | `primary` | `#0f766e` | `#2dd4bf` |
   | `#0f172a` | 一级文字（最深） | `onSurface` | `#0f172a` | `#f1f5f9` |
   | `#334155` | 正文长文本（`lineHeight: 22`） | `textBody` | `#334155` | `#e2e8f0` |
   | `#475569` | 二级/说明文字 | `onSurfaceVariant` | `#475569` | `#cbd5e1` |
   | `#64748b` | 三级/辅助文字（最浅） | `textMuted` | `#64748b` | `#94a3b8` |
   | `#ffffff` | 卡片底、输入框底 | `surface` | `#ffffff` | `#1e293b` |
   | `#f8fafc` | 页面底 / 卡片内的内嵌次级块 | `background` | `#f8fafc` | `#0f172a` |
   | `#dc2626` | 错误 / 危险操作 | `error` | `#dc2626` | `#f87171` |
   | `#16a34a` | 成功 | `success` | `#16a34a` | `#4ade80` |
   | （无字面量，主题内） | 描边 | `outline` | `#cbd5e1` | `#334155` |
   | （无字面量，主题内） | 次级表面 | `surfaceVariant` | `#e2e8f0` | `#334155` |
   | （无字面量，主题内） | 次要色 | `secondary` | `#2563eb` | `#60a5fa` |
   | （无字面量，主题内） | 第三色 | `tertiary` | `#d97706` | `#fbbf24` |

   深色值是浅色 slate 色阶的镜像（900/700/600/500 → 100/200/300/400），并已按 slate-800 卡片底做过对比度取舍：三级文字用 slate-400 而非 slate-500，后者在深色卡片上约 3:1，低于可读阈值。

   **注意 `#334155` 与 `#0f172a` 都被用于 `lineHeight: 22` 的长文本**（`prediction.tsx` 的 `heroText` 用前者、`stats.tsx` 的 `aiResultText` 用后者）—— 这是既有的不一致。**不要顺手统一它们**，按上表一一对应替换即可，本任务不得改变浅色模式的任何观感。

3b. **深色主题还必须覆盖一批没有硬编码字面量的继承色槽**（实施期间发现，补充进本表）：

   深色主题以 `MD3DarkTheme` 为结构底座（`onPrimary`、`elevation`、`inverseSurface` 等约 30 个色槽无法从浅色主题继承）。但 MD3 深色基线**全部带紫调** —— 这正是决策 2 明确否决 `MD3DarkTheme` 的原因。若只覆盖上表 13 个槽，紫调会从下列组件重新渗回来：

   | 色槽 | 谁在用 | MD3 深色继承值 | 本项目深色值 |
   |---|---|---|---|
   | `elevation.level0~5` | `Dialog` / `Menu` / 抬升的 `Surface` | `rgb(37,35,42)` ~ `rgb(52,49,63)` 紫调近黑 | `transparent` / `#1e293b` / `#233042` / `#283748` / `#2b3b4d` / `#2f4053` |
   | `inverseSurface` | `Snackbar` 底色（MD3 中 Snackbar 反色） | 紫白 | `#e2e8f0` |
   | `inverseOnSurface` | `Snackbar` 文字 | 深紫 | `#0f172a` |
   | `inversePrimary` | `Snackbar` 上的操作按钮 | 紫 | `#0f766e` |
   | `outlineVariant` | `Divider`（`history.tsx` 在用） | 紫灰 | `#334155` |
   | `onPrimary` / `onSecondary` / `onTertiary` / `onError` | 实心按钮上的文字 | 深紫系 | `#0f172a` |
   | `onBackground` | 页面级默认文字 | 紫白 | `#f1f5f9` |
   | `backdrop` | `Dialog` 遮罩 | `rgba(51,47,55,0.4)` | `rgba(15,23,42,0.5)` |

   `elevation` 继承值还有一个方向性错误：它们比卡片底色 `#1e293b` **更暗**，而抬升的表面应当更亮。上表的阶梯自底向上逐级变亮。

   **浅色主题的 `elevation` 不动** —— 保持既有观感，且浅色下的紫调是接近纯白的，不可感知。

### 二、`apps/mobile/app.json`

4. `userInterfaceStyle` 由 `"light"` 改为 `"automatic"`。**不改动 `plugins` 数组以外的其他字段**，新插件需注册进 `plugins`。

### 三、启动白闪 —— 新增 config plugin

5. 在 `apps/mobile/plugins/` 下新增一个 config plugin，使用 `expo/config-plugins` 的 `withAndroidColorsNight`，写入夜间版本的 `activityBackground` 与 `splashscreen_background`，值均为深色 `background`（`#0f172a`）。照抄 `withCleartextTraffic.js` 的 CommonJS + eslint-disable 头部写法。

6. 在 `app.json` 的 `plugins` 数组中注册该插件。

7. **禁止手改 `apps/mobile/android/`** —— 该目录 gitignore 且由 CI 重新生成。

### 四、根布局与导航

8. `app/_layout.tsx`：用 React Native 的 `useColorScheme()` 选择主题传给 `PaperProvider`；`StatusBar` 由 `style="dark"` 改为 `style="auto"`；`Stack` 的 `contentStyle` 与 `AppLoadingScreen` 改为运行时取主题；`styles.root` 的背景色**因位于 `PaperProvider` 之外，必须直接由 `useColorScheme()` 结果决定**，不能用 `useTheme()`。

9. `app/(tabs)/_layout.tsx`：删除对 `appTheme` 常量的静态 import，改为在组件内 `useAppTheme()`。**这是最容易漏的一处 —— 不改则深色下 Tab 栏与顶部导航栏永远浅色，且无任何自动检查能发现。**

9b. `app/settings/_layout.tsx`：**本 PRD 初稿遗漏，实施期间补入**。它与 `(tabs)/_layout.tsx` 犯同一个错 —— 静态引用主题常量设置设置页的 header 与内容背景，且同样一处色值字面量都没有，因而不会被任何自动检查发现。改法与第 9 条完全一致。

   遗漏原因值得记下：本任务的文件清单是靠「搜 `#rrggbb` 字面量」推导的，而这类**只引用主题常量、不含字面量**的文件恰好落在该方法的盲区。第 13 条的 lint 规则同样看不见它们。真正能覆盖这个盲区的是「搜索谁 import 了主题模块」。

### 五、6 个界面的样式表改造

10. 下列 6 个文件的 `StyleSheet.create` 改为「按主题生成」—— 保留样式集中定义的形态，把它变成接收主题、返回样式表的函数，在组件内以 `useMemo` 依主题缓存：

    - `app/(tabs)/index.tsx`
    - `app/(tabs)/stats.tsx`
    - `app/(tabs)/prediction.tsx`
    - `app/(tabs)/history.tsx`
    - `app/settings/index.tsx`
    - `app/settings/ai.tsx`

11. `app/settings/index.tsx` 有两处颜色写在 JSX 内联而非样式表中，同样要改：
    - `:501` `Dialog.Title` 的 `syncDialogSuccess ? "#16a34a" : "#dc2626"` → `success` / `error`
    - `:521` `Button` 的 `textColor="#dc2626"` → `error`

12. **只改颜色，不改任何布局、间距、字号、圆角、组件结构或文案。** 本任务对浅色模式应当是**像素级无变化**的。

### 六、防漏改的自动检查

13. 在 `eslint.config.js` 中新增一个作用域限定为 `apps/mobile/**/*.{ts,tsx}` 的规则块，用 `no-restricted-syntax` 禁止 `#rrggbb` / `#rgb` 形式的颜色字面量，报错信息需指明「改用 src/theme.ts 的主题令牌」。

14. `apps/mobile/src/theme.ts` 是色值的唯一合法归属地，需在该规则中排除。

15. 该规则由既有的 `npm run lint` 覆盖，因而自动并入 `npm run check`，**不需要新增 npm script**。

## Acceptance Criteria

- [ ] `npm run check` 全绿（typecheck ×3 + lint + test:core + mobile:export），退出码 0
- [ ] 全仓搜索：`apps/mobile` 下除 `src/theme.ts` 外，**无任何 `#rrggbb` 字面量残留**（含 JSX 内联）
- [ ] 故意在任一界面写回一个 `#ffffff`，`npm run lint` **必须报错** —— 证明这道检查具备区分力
- [ ] `app.json` 的 `userInterfaceStyle` 为 `"automatic"`，新 plugin 已注册
- [ ] `apps/mobile/android/` 无改动（`git status` 中不出现，该目录已 gitignore）
- [ ] `app/(tabs)/_layout.tsx` 不再静态 import `appTheme`
- [ ] `app/_layout.tsx` 的 `styles.root` 背景色由 `useColorScheme()` 决定，而非 `useTheme()`（它在 `PaperProvider` 之外）
- [ ] 浅色模式下所有颜色值与改造前逐一相等 —— 对照本 PRD 映射表的「浅色值」列核对
- [ ] 搜索「谁 import 了主题模块」，确认每一个引用方都已改为运行时取主题，无残留的静态常量引用（这是 lint 规则的盲区，只能靠此项覆盖）
- [ ] 6 个界面文件的样式表均改为按主题生成，且以 `useMemo` 依主题缓存
- [ ] `git diff` 中无布局、间距、字号、圆角、组件结构或文案的改动

**已知无法在本环境验证的部分**：深色下的实际观感、对比度是否舒适、启动白闪是否真的消除（后者需真机安装 APK 确认）。经与需求方确认，本轮不做专门验收。这道 lint 规则拦得住「漏改」，拦不住「改错」。

**浅色模式有一处已知的、刻意接受的变化**：改造前主题从未设置 `onSurface`，它一直继承 MD3 默认的 `rgb(28,27,31)`（暖调近黑）；映射表要求把它设为 `#0f172a`（slate-900，冷调）。受影响的是设置齿轮图标与 Paper 各组件的默认文字色。两者差异接近不可感知，但「浅色像素级无变化」对这一个色槽严格来说不成立。采纳该变化是因为它消除了「显式写的文字是冷灰、默认继承的文字是暖黑」这一既有的不协调。

## Definition of Done

- `npm run check` 本机通过
- lint / typecheck 全绿
- commit message 使用中文，遵循 `docs/commit-convention.md`
- 无需 docs 更新

## Technical Approach

**样式表按主题生成**，而非静态样式表 + 内联覆盖。前者保持「颜色集中在文件底部一处」这一既有习惯不变，6 个文件同一套机械改法；后者会把颜色散进 JSX，且新增 UI 时极易漏写。

**自定义令牌通过扩展主题类型实现**，而非另建一个独立的调色板对象。后者会造成「Paper 主题」与「自己的调色板」两个真相源，界面里要同时从两处取色。

**不引入主题上下文或 Provider**：`PaperProvider` 已经是主题上下文，`useTheme()` 已能在任意深度取到，重复造轮子无意义。

**不改动布局与结构**：本任务唯一变量是颜色。任何布局改动都会污染 diff，使「浅色模式是否零变化」变得无法核对。

## Decision (ADR-lite)

**Context**：移动端仅有硬编码浅色主题，颜色散落 6 个界面约 80 处；需求方选择不做专门的运行时验收。

**Decision**：
1. 只跟随系统，不提供开关 —— 规避异步读取偏好导致的启动闪烁
2. 深色沿用 slate 冷灰风镜像配置，不用 Paper 默认深色（紫调）或 Material You（不可验收）
3. 样式表改为按主题生成，颜色保持集中
4. 自定义令牌扩展进 Paper 主题类型，维持单一取色来源
5. 新增 lint 规则禁止手机端硬编码颜色，作为「漏改」的编译期防线
6. 启动白闪通过 config plugin 补 `values-night` 颜色资源解决，不手改原生目录

**Consequences**：
- 用户无法在 App 内单独设置主题，只能改系统设置。已知并接受
- lint 规则会约束将来所有新增的移动端界面 —— 这是意图内的长期收益，但也意味着新写界面时必须先想清楚用哪个令牌
- 启动白闪的修复无法在本机验证，需真机安装 APK 确认
- 「改错颜色」（如描边色错配成文字色）无自动化防线，仍需真机
- `apps/mobile` 的主题从一个常量变为两个 + 一个 Hook，`(tabs)/_layout.tsx` 等静态引用点必须同步改造

## Out of Scope

- **不做 App 内主题开关**，不做三选一（跟随/浅色/深色）
- **不做 Material You 动态取色**
- **不改桌面端** —— 桌面端目前完全没有黑夜模式，用的是 Mantine，颜色表达方式与 Paper 不同。本次不碰
- **不把色板下沉到 `packages/`** —— 现在只有移动端一个使用方，属过早抽象。将来桌面端真要做深色时再抽
- **不改动任何布局、间距、字号、圆角、组件结构、文案**
- **不改变浅色模式的任何观感** —— 包括不「顺手统一」`#334155` 与 `#0f172a` 这处既有的正文色不一致
- **不做真机验收**

## Technical Notes

### 关键文件

| 文件 | 涉及内容 |
|---|---|
| `apps/mobile/src/theme.ts` | 浅色 + 深色两套主题、自定义令牌、类型化 `useAppTheme` |
| `apps/mobile/app.json` | `userInterfaceStyle` 改 `automatic`、注册新 plugin |
| `apps/mobile/plugins/`（新增） | `withAndroidColorsNight` 补夜间原生底色 |
| `apps/mobile/app/_layout.tsx` | 主题选择、状态栏、Stack 背景、`styles.root`（在主题作用域外） |
| `apps/mobile/app/(tabs)/_layout.tsx` | **最易漏** —— 静态引用改运行时取主题 |
| `apps/mobile/app/(tabs)/index.tsx` | 7 处颜色 |
| `apps/mobile/app/(tabs)/stats.tsx` | 15 处颜色 |
| `apps/mobile/app/(tabs)/prediction.tsx` | 10 处颜色 |
| `apps/mobile/app/(tabs)/history.tsx` | 10 处颜色 |
| `apps/mobile/app/settings/index.tsx` | 21 处样式表颜色 + 2 处 JSX 内联 |
| `apps/mobile/app/settings/ai.tsx` | 6 处颜色 |
| `eslint.config.js` | 禁止移动端硬编码颜色的规则 |

### 约束

- `apps/mobile/android/` 已 gitignore 且由 CI `expo prebuild` 重新生成，原生层改动**必须**走 config plugin。参见 `.trellis/spec/frontend/mobile-implementation.md` 的 Expo Config Plugins 一节，其中已记录三个踩坑点（`createAndroidManifestPlugin` 未导出、回调参数是 `mod.modResults`、加插件后需 `--clean` 重新生成）
- `packages/core` 是纯数据逻辑包，React Native 主题**不得**下沉
- 前两个任务刚改过 `app/(tabs)/index.tsx` 的按钮区（新增 `cancelButton` 样式，无颜色）与 `src/hooks/useTimer.ts`（无颜色）

### 实施中发现的额外事实

**`app.json` 的 `userInterfaceStyle` 在本项目中其实是一条空配置。** 本地跑 `npx expo prebuild --platform android --clean` 时 Expo 明确提示：

```
» android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.
```

该字段在 Android 上由 `expo-system-ui` 落地，而本项目未安装它，因此**改造前的 `"light"` 和改造后的 `"automatic"` 都不产生任何原生效果**。

这不影响本任务的正确性，原因经生成产物逐项核实：

- `AppTheme` 的父主题是 `Theme.AppCompat.DayNight.NoActionBar`，其默认夜间模式为「跟随系统」
- 生成的 `MainActivity.kt` 中**没有**任何 `setDefaultNightMode` 调用，即无任何一侧被强制
- `AndroidManifest.xml` 的 `configChanges` 已含 `uiMode`，系统切换深浅色时 Activity 不会重启
- 因此原生层本来就跟随系统；改造前之所以永远浅色，纯粹是 JS 侧只有一套硬编码浅色主题

`userInterfaceStyle` 仍改为 `"automatic"`：它准确描述了应用的实际行为，留着 `"light"` 会误导后人以为存在强制浅色的机制。**但不为此引入 `expo-system-ui` 依赖** —— 「不装它」与「装它并设为 automatic」的运行时行为完全一致，为一条文档性配置增加原生依赖不划算。

**config plugin 产物已实测确认**：`android/app/src/main/res/values-night/colors.xml` 正确生成，内含 `activityBackground` 与 `splashscreen_background` 均为 `#0f172a`；浅色的 `values/colors.xml` 未受影响。

**一处未修的既有缺陷**：`prediction.tsx` 的「样本不足」状态标题取 `theme.colors.outline` 作文字色。`outline` 的定位是描边，浅色下 `#cbd5e1` 配白卡片对比度约 1.5:1，本就几乎看不清。本次按映射表一比一镜像（深色 `#334155` 配 `#1e293b` 约 1.4:1），**没有变好也没有变坏**。修它属于「该状态标题应改用 `textMuted`」的独立问题，会改变浅色观感，不在本任务范围。

### 需求收敛过程

本 PRD 由一次完整的 grilling 会话收敛而成。本任务对应其中 4 个决策点（切换方式 / 深色配色底子 / 改造方式 / 色板归属），另加一项在会话中新提出并被采纳的防漏改检查。会话中通过读取原生资源文件确认了启动白闪的存在与成因，通过 `git ls-files` 确认了 `android/` 目录未入库这一决定性事实 —— 后者直接否决了「手改 `values-night`」这一看似最省事的方案。

实施期间对 PRD 做过三处补充，均因初稿的推导方法有盲区：色槽映射表遗漏了 MD3 深色继承来的紫调（第 3b 节）、文件清单遗漏了 `settings/_layout.tsx`（第 9b 节）、以及上述 `userInterfaceStyle` 的空配置事实。三者的共同成因是初稿依赖「搜索 `#rrggbb` 字面量」来划定范围，而**不含字面量的颜色来源**（继承色槽、主题常量引用、原生配置）全在该方法的盲区里。
