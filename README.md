![DickHelper](https://socialify.git.ci/zzzdajb/DickHelper/image?description=1&forks=1&name=1&owner=1&pattern=Plus&stargazers=1&theme=Light)

# 牛子小助手 (DickHelper)

[![Electron](https://img.shields.io/badge/Electron-35-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Mantine](https://img.shields.io/badge/Mantine-7-339AF0.svg)](https://mantine.dev/)

一个简单、高效、**支持全平台使用**的打飞机记录工具。

A simple, efficient, **cross-platform** masturbation recording tool.

<img width="1656" height="1176" alt="image" src="https://github.com/user-attachments/assets/c3ac129e-9da4-4702-9d89-7ffdc8a3beda" />

<img width="1656" height="1176" alt="image" src="https://github.com/user-attachments/assets/6b2c525d-8594-47fa-9ef8-293a6f811565" />

---
## 移动端MVP开发完成 | Mobile MVP Released

牛子小助手安卓版本现已上线，功能基本开发完毕，但是由于目前项目是**桌面优先**的策略，移动端在部分功能上可能**有所落后**，还请谅解。

下载地址 | Download: https://github.com/zzzdajb/DickHelper/releases/tag/mobile-v0.0.3

移动端现已支持LAN同步功能，您现在可以在任意设备上自由的记录您的体验。

---

## 天梯排行榜 | Leaderboard

和全球所有牛子小助手的用户进行时长和次数比拼吧！

该项目部署于Cloudflare Workers，受限于免费服务质量，可能存在不稳定的情况，还请谅解。

---

## 特点 | Features

- 🔒 **隐私至上**: SQLite 数据库，本地存储，最大程度确保数据 安全 
- 📊 **统计看板**: 多种统计图表 + 发射日历热力图，轻松掌握自身状态 
- 📋 **历史记录**: 轻松浏览、搜索历史记录，历史数据永不丢失

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

### 发布版本 | Release

GitHub Release 使用 `vX.Y.Z` tag，例如 `v2.0.4`。

发布前须先将 `package.json` 的 `version` 调整为不带 `v` 的版本号，例如 `2.0.4`。

Release workflow 会校验：
- `RELEASE_TAG` 必须形如 `v2.0.4`
- `package.json.version` 必须等于 `2.0.4`

校验通过后，workflow 会打包 Windows / macOS / Linux 安装包，并上传自动更新所需的 `latest.yml`、`latest-mac.yml`、`latest-linux.yml` 等 metadata。

已安装 `2.0.3` 的客户端会在发现 `2.0.4` metadata 后会自动提示更新。

### 自动更新 | Auto Update

应用启动时会自动检查更新。发现新版本后，会在应用内弹窗询问是否下载，不会静默下载。下载完成后，用户可以手动点击重启安装。

更新源默认使用 `https://ghfast.top` 镜像，适合 GitHub 访问不稳定的中国大陆环境；考虑到镜像源的SLA并不稳定，用户可在设置页当中自行切换到 GitHub 直连。

若当前更新源检查失败，应用将提示失败并建议切换源，不会自动回退。

测试自动更新的推荐流程见 [自动更新测试指南](docs/auto-update-testing.md)。

---

## 技术栈 | Tech Stack

| 层 | Layer | 技术 |
|----|-------|------|
| GUI框架 | Desktop Shell | Electron 35 |
| UI 框架 | UI Framework | React 19.1 |
| 语言 | Language | TypeScript 5.7 (strict) |
| 组件库 | UI Library | Mantine 7 |
| 数据库 | Database | SQLite via sql.js (WASM) |

---

## 数据迁移 | Data Migration

从旧版 Web 端迁移数据：

1. 在旧版页面点击"导出数据"，下载 `masturbation_records.json`
2. 在 DickHelper v2 中点击"导入数据"，选择该文件
3. v2 自动识别旧格式，将 `startTime` 映射为 `EndTime`，按 UUID 跳过重复记录
4. 导入完成后显示结果：成功 / 跳过重复 / 拒绝无效

详细见 [迁移文档](docs/migration-guide.md)

---

## 隐私说明 | Privacy Statement

所有数据存储在本地 SQLite 数据库中，当您使用本地功能的时候，不会有任何数据上传到任何服务器。
未经您允许，我们不会收集您的任何敏感信息——我们可能会收集您的非敏感信息以用于软件开发，包括但是不限于：系统版本、软件版本，以及匿名生成的UUID。
所有信息上报逻辑全部开源于代码当中，如果您对此感到担忧，欢迎您自行审查代码。

当您使用需要网络服务才能提供的功能时，我们需要您的数据才能继续为您提供相关服务，但是除非您主动打开网络功能，否则我们在默认的状态下不会上传您的任何敏感数据。

---

## 许可证 | License

GPL-3.0（GNU General Public License v3.0）

---

## 社区 | Community

没有什么人活跃的QQ交流群：745297798

该群为作者私人群，仅供作者产出奇怪的开源作品使用。

---

## 友链 | Friends
[Linux.do](https://linux.do/)

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zzzdajb/DickHelper&type=Timeline)](https://star-history.com/#zzzdajb/DickHelper&Timeline)
