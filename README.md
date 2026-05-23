![DickHelper](https://socialify.git.ci/zzzdajb/DickHelper/image?custom_description=An+easy-to-use+masturbation+management+recording+tool&description=1&forks=1&language=1&logo=https%3A%2F%2Fs2.loli.net%2F2025%2F02%2F21%2FkI3Ebc5hdGTSlLp.png&name=1&owner=1&stargazers=1&theme=Light)

# 牛子小助手 (DickHelper) v2

[![Electron](https://img.shields.io/badge/Electron-35-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Mantine](https://img.shields.io/badge/Mantine-7-339AF0.svg)](https://mantine.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg)](https://www.sqlite.org/)

一个简单、高效、易用的打飞机记录工具，帮助你科学管理✈️生活。

An easy-to-use masturbation management recording tool, now as a cross-platform desktop app.

QQ交流群：745297798 （该群为作者个人的群，作者偶尔会写些奇奇怪怪的东西）

---

## v2 重构完成 | v2 Rewrite Complete

DickHelper v2 已从旧版 Web 应用完全重写为 **Electron 桌面应用**。使用更现代的技术栈，修复了旧版数据模型的 bug，体验更流畅。

- **旧版 Demo**（Web 端，不再维护）: https://dick.juwo.my
- **数据迁移**: v2 支持从旧版导出的 JSON 文件导入数据（自动识别旧格式并映射字段，按 UUID 去重）

DickHelper v2 has been completely rewritten as an **Electron desktop app** with a modern tech stack, fixed data model, and smoother experience.

- **Legacy Demo** (Web, deprecated): https://dick.juwo.my
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
- **Windows**: 需要 [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) 或 Visual Studio Build Tools（用于编译 better-sqlite3 原生模块）
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `build-essential` + `python3`

> **Windows**: better-sqlite3 requires native module compilation. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with "Desktop development with C++" workload, or run `npm install --global windows-build-tools` as administrator.

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

### 常见问题 | Troubleshooting

**`better-sqlite3` 安装失败 | Installation fails**

```bash
# 手动重编译原生模块 | Manually rebuild native modules
npx electron-rebuild
```

`npm install` 已配置 `postinstall` 脚本自动执行此步骤。如果仍然失败，请确保安装了 Visual Studio Build Tools (Windows) 或 Xcode Command Line Tools (macOS)。

**窗口白屏 | White screen on launch**

开发模式下确保 Vite dev server 已启动。生产模式下检查 `out/renderer/index.html` 是否存在。

---

## 技术栈 | Tech Stack

| 层 | Layer | 技术 | Technology |
|----|-------|------|------------|
| 桌面框架 | Desktop Shell | Electron 35 | — |
| UI 框架 | UI Framework | React 19.1 | — |
| 语言 | Language | TypeScript 5.7 (strict) | — |
| 构建 | Build | electron-vite + Vite 6 | — |
| 组件库 | UI Library | Mantine 7 | — |
| 图标 | Icons | @tabler/icons-react | — |
| 数据库 | Database | SQLite via better-sqlite3 | — |
| 图表 | Charts | 纯 CSS 热力图 | Pure CSS heatmap |

## 数据迁移 | Data Migration

从旧版 Web 端迁移数据：

1. 在旧版页面点击"导出数据"，下载 `masturbation_records.json`
2. 在 DickHelper v2 中点击"导入数据"，选择该文件
3. v2 自动识别旧格式，将 `startTime` 映射为 `EndTime`，按 UUID 跳过重复记录
4. 导入完成后显示结果：成功 / 跳过重复 / 拒绝无效

详细说明见 [docs/migration-guide.md](docs/migration-guide.md)

---

## 隐私说明 | Privacy Statement

所有数据存储在本地 SQLite 数据库中，不会上传到任何服务器。未经您允许，我们不会收集您的任何信息。

All data is stored in a local SQLite database and is never uploaded to any server. We do not collect any of your information without your permission.

---

## 许可证 | License

GPL-3.0（GNU General Public License v3.0）

[NodeSupport](https://github.com/NodeSeekDev/NodeSupport)赞助了本项目

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zzzdajb/DickHelper&type=Timeline)](https://star-history.com/#zzzdajb/DickHelper&Timeline)
