# 调查移动端遥测不上报问题

## Goal

对当前仓库中的遥测实现做静态分析，确认移动端遥测链路是否完整、与桌面端相比是否存在实现差异，并给出最可能导致“云端看不到移动端数据”的原因列表与验证建议。此任务不修改现有业务代码。

## What I already know

* 项目是 monorepo：移动端在 `apps/mobile/**`，桌面端在根 `src/**`，共享逻辑在 `packages/*`。
* 用户反馈：最近新增遥测模块后，云端没有看到移动端数据，至少用户本人使用后未观察到上报结果。
* 遥测设计文档位于 `.trellis/plans/telemetry-system.md`，其中声明桌面端和移动端都应接入。
* 当前实际代码并未实现设计文档中的事件批量上报，而是简化为一次 `telemetry/launch` 活跃上报。
* 移动端存在 `apps/mobile/src/hooks/useTelemetry.ts`，并在 `apps/mobile/app/_layout.tsx` 中通过 `TelemetryBootstrap` 挂载。
* 桌面端存在 `src/renderer/hooks/useTelemetry.ts`，并在 `src/renderer/App.tsx` 中挂载。
* Worker 当前只暴露 `POST /api/v1/telemetry/launch`，写入 `telemetry_daily` 表。
* 版本发布链路中，`mobile-latest` 仍指向 `mobile-v0.0.2`，而当前 `main` 中的遥测提交为 `e6e1605`，`mobile-v0.0.3` 在该提交之后。

## Assumptions

* 用户所说“自己使用了移动端”可能是通过 GitHub Release 安装 APK，而不一定是本地源码运行。
* 云端“没有看到数据”指的是后端表、面板或人工查询结果中没有出现 `platform = mobile` 的记录。
* 本次目标是定位最可能的问题点，不要求在本任务中完成修复或发布验证。

## Open Questions

* 用户实际使用的是哪一种移动构建：本地开发构建、`mobile-v0.0.3` 版本包，还是 `mobile-latest` 稳定通道。
* 云端观察口径是什么：直接查库、看日志，还是看某个自定义统计视图。

## Requirements

* 梳理移动端遥测从 hook 挂载、设置读取、UUID 生成、网络请求到 Worker 落库的完整链路。
* 对比桌面端实现，找出移动端特有的薄弱点。
* 检查发布/tag 链路是否可能导致“源码已接入但用户安装包未包含该功能”。
* 输出结论时区分“高置信问题”“中等置信风险”“需要动态验证才能确认”的项。

## Acceptance Criteria

* [ ] 给出移动端遥测链路的静态分析结果。
* [ ] 给出至少一个高置信度原因，解释为何云端可能看不到移动端数据。
* [ ] 给出建议的最小验证步骤，但不修改代码。

## Definition of Done

* 分析范围覆盖 `apps/mobile/**`、`packages/core/**`、`packages/shared/**`、`worker/**` 与相关发布配置。
* 结论明确标注证据来源文件。
* 不修改现有业务代码。

## Out of Scope

* 修复遥测逻辑。
* 修改 Worker、移动端或桌面端实现。
* 重新发布 APK 或触发线上验证。

## Technical Notes

* 关键文件：
  * `apps/mobile/src/hooks/useTelemetry.ts`
  * `apps/mobile/app/_layout.tsx`
  * `apps/mobile/app/settings/index.tsx`
  * `src/renderer/hooks/useTelemetry.ts`
  * `packages/core/src/telemetryClient.ts`
  * `worker/src/index.ts`
  * `.github/workflows/android-release.yml`
* 已发现的初步风险：
  * 移动端 `useTelemetry` 直接使用 `crypto.randomUUID()`，未复用 `MobileDatabaseService` 中已有的 fallback 逻辑。
  * `mobile-latest` 标签仍停在 `mobile-v0.0.2`，可能导致稳定通道用户拿到的 APK 根本不含遥测功能。
