![DickHelper](https://socialify.git.ci/zzzdajb/DickHelper/image?description=1&forks=1&name=1&owner=1&pattern=Plus&stargazers=1&theme=Light)

# 牛子小助手 (DickHelper)

[![Electron](https://img.shields.io/badge/Electron-35-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Mantine](https://img.shields.io/badge/Mantine-7-339AF0.svg)](https://mantine.dev/)

一个简单、高效、易用的打飞机记录工具，帮助你科学管理✈️生活。

An easy-to-use masturbation management recording tool, now as a cross-platform desktop app.

没有什么人活跃的QQ交流群：745297798 

该群为作者私人群，仅供作者产出奇怪的开源作品使用

---

## v2 重构完成 | v2 Rewrite Complete

DickHelper v2 已从旧版 Web 应用完全重写为 **Electron 桌面应用**。使用更现代的技术栈，修复了旧版数据模型的 bug，体验更流畅。

- **数据迁移**: v2 支持从旧版导出的 JSON 文件导入数据（自动识别旧格式并映射字段，按 UUID 去重）

DickHelper v2 has been completely rewritten as an **Electron desktop app** with a modern tech stack, fixed data model, and smoother experience.

- **Data Migration**: v2 supports importing JSON files exported from the legacy version (auto-detects old format, maps fields, deduplicates by UUID)

---

## 特点 | Features

- 🔒 **数据本地存储**: SQLite 数据库，数据完全在本地，无需担心隐私泄露 | **Local Storage**: SQLite database, all data stored locally
- 📊 **统计看板**: 总次数、平均时长、周/月频率统计 + 发射日历热力图 | **Statistics**: Total count, avg duration, weekly/monthly frequency + heatmap calendar
- ⏱️ **计时器**: 开始/暂停/继续/停止，精确记录每次时长 | **Timer**: Start/pause/resume/stop with precise duration tracking
- 🔄 **数据导入导出**: JSON 格式，兼容旧版数据，按 UUID 去重 | **Import/Export**: JSON format, legacy compatible, UUID dedup
- 📋 **历史记录**: 浏览、搜索、删除单条或清空全部 | **History**: Browse, delete individual records or clear all
- 📌 **系统托盘**: 关闭窗口缩到托盘，后台运行不打扰 | **System Tray**: Minimize to tray, runs quietly in background

---

## 本地开发 | Local Development

### 前置要求 | Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### 启动开发环境 | Start Development

```bash
# 克隆项目 | Clone the repository
git clone https://github.com/zzzdajb/DickHelper.git

# 进入项目目录 | Enter the project directory
cd DickHelper

# 安装依赖 | Install dependencies
npm install

# 启动开发模式（热重载） | Start dev mode (hot reload)
npm run dev
```

`npm run dev` 会同时启动：
- Vite dev server（React 渲染进程热重载）
- Electron 主进程（自动打开桌面窗口）

### 构建生产版本 | Build for Production

```bash
# 构建可分发安装包 | Build distributable package
npm run build
```

构建输出在 `out/` 目录：
- `out/main/` — Electron 主进程
- `out/preload/` — 预加载脚本
- `out/renderer/` — React 渲染进程（静态文件）

> 自动更新和安装包打包（electron-builder）暂未配置，后续版本添加。

## 技术栈 | Tech Stack

| 层 | Layer | 技术 | Technology |
|----|-------|------|------------|
| 桌面框架 | Desktop Shell | Electron 35 | — |
| UI 框架 | UI Framework | React 19.1 | — |
| 语言 | Language | TypeScript 5.7 (strict) | — |
| 构建 | Build | electron-vite + Vite 6 | — |
| 组件库 | UI Library | Mantine 7 | — |
| 数据库 | Database | SQLite via sql.js (WASM) | — |

## 数据迁移 | Data Migration

从旧版 Web 端迁移数据：

1. 在旧版页面点击"导出数据"，下载 `masturbation_records.json`
2. 在 DickHelper v2 中点击"导入数据"，选择该文件
3. v2 自动识别旧格式，将 `startTime` 映射为 `EndTime`，按 UUID 跳过重复记录
4. 导入完成后显示结果：成功 / 跳过重复 / 拒绝无效

详细说明见 [迁移文档](docs/migration-guide.md)

---

## 隐私说明 | Privacy Statement

所有数据存储在本地 SQLite 数据库中，不会上传到任何服务器。未经您允许，我们不会收集您的任何信息。

All data is stored in a local SQLite database and is never uploaded to any server. We do not collect any of your information without your permission.

---

## 许可证 | License

GPL-3.0（GNU General Public License v3.0）

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zzzdajb/DickHelper&type=Timeline)](https://star-history.com/#zzzdajb/DickHelper&Timeline)
