# setup-monorepo-extract-shared-lib

## Goal

为未来 Expo/React Native 移动端做准备，极度保守地设置 monorepo 结构，只把纯 TypeScript 类型定义抽到 `packages/shared/`。

## Requirements

- 创建 `packages/shared/` workspace 包 (`@dickhelper/shared`)
- 只包含纯类型：IRecord, IRecordRaw, IStats, IDailyCount, IImportResult, IUpdateSettings, IUpdateState, UpdateSource, UpdateStatus
- shared 包零依赖、无构建步骤
- 更新所有导入路径，删除旧文件
- 消除 `main/database.ts` 中重复的类型定义

## Acceptance Criteria

- [ ] `npm run build` 通过
- [ ] `tsc --noEmit` (node + web) 通过
- [ ] 所有 `import type` 指向 `@dickhelper/shared`

## Technical Approach

见 plan file: `C:\Users\York\.claude\plans\fancy-munching-summit.md`
