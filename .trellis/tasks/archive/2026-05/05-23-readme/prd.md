# 更新 README 并编写启动教程

## Goal

将 README.md 从旧版 Web 应用说明更新为 Electron 桌面应用说明，保留双语（中英）格式，并加入本地开发/构建启动教程。

## Requirements

- 更新技术栈 badges（Electron + React 19 + TypeScript + Mantine 7 + SQLite + Vite）
- 移除"项目重构中"通知（重构已完成）
- 移除 Web 部署章节（Vercel、Cloudflare Pages、Docker）
- 更新 Features 部分反映桌面应用特性
- 添加 "本地开发 | Development" 章节：`npm install` → `npm run dev` → `npm run build`
- 添加前置要求（Node.js 版本、npm、native build tools for better-sqlite3）
- 保留：QQ群、隐私说明、License、Star History
- 更新在线 Demo 说明（如果 Demo 仍有效则保留，否则标注为旧版 Web Demo）
- 语言：中英双语并列

## Acceptance Criteria

- [ ] README 技术栈反映 Electron + Mantine + SQLite
- [ ] 本地开发教程完整可用（npm install → dev → build）
- [ ] 移除了不相关的 Web 部署内容
- [ ] 双语格式保留

## Out of Scope

- 不创建单独的 CONTRIBUTING.md 或开发者文档
- 不添加截图/GIF 演示（可后续补充）
