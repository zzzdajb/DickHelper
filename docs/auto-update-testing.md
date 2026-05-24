# 自动更新测试指南

> 自动更新只在已打包安装的应用中启用。`npm run dev` 下会显示“开发模式不检查更新”，不能用于端到端验证自动更新。

---

## 推荐测试方式

最可靠的测试方式是：**先安装一个旧版本，再发布一个更高版本的 GitHub Release**，让旧版本客户端从 Release metadata 中发现更新。

以从 `2.0.3` 升级到 `2.0.4` 为例：

1. 从 GitHub Release 下载并安装旧版本 `v2.0.3`。
2. 确认新版本代码中的 `package.json` 为：

   ```json
   {
     "version": "2.0.4"
   }
   ```

3. 创建并推送 tag：

   ```bash
   git tag v2.0.4
   git push origin v2.0.4
   ```

4. 等待 Release workflow 完成。
5. 在 GitHub Release 页面确认上传了安装包、blockmap 和 updater metadata。
6. 打开已安装的 `2.0.3` 客户端，等待启动自动检查，或进入设置页手动点击检查更新。
7. 看到更新弹窗后，点击下载，确认设置页能显示下载进度。
8. 下载完成后点击重启安装，应用重启后确认当前版本变为 `2.0.4`。

> 当前更新地址指向生产仓库的 `releases/latest/download/`。发布正式 stable Release 后，所有已安装旧版本的用户都可能收到更新提示。不要用生产仓库的 stable Release 做临时或无效版本测试。

---

## 版本号规则

Electron updater 比较的是应用包版本，也就是 `package.json.version`。GitHub tag 只是发布入口。

正确对应关系：

| GitHub tag | `package.json.version` |
|------------|------------------------|
| `v2.0.4` | `2.0.4` |

注意事项：

- tag 必须是 `vX.Y.Z`，例如 `v2.0.4`。
- `package.json.version` 必须是不带 `v` 的 `X.Y.Z`。
- 新版本号必须高于已安装版本，否则客户端不会提示更新。
- 当前 release workflow 会在版本不匹配时提前失败，避免发布错误 metadata。
- 当前配置不启用 prerelease 更新。

---

## Release 资产检查

自动更新依赖 `electron-builder` 生成的 metadata 文件。Release 里必须同时存在 metadata 和它引用的原始文件名，不能重命名安装包后只上传旧 metadata。

按平台检查：

| 平台 | 必需资产 |
|------|----------|
| Windows | `latest.yml`、`*.exe`、`*.exe.blockmap` |
| macOS | `latest-mac.yml`、`*.dmg`、`*.zip`、`*.zip.blockmap` |
| Linux | `latest-linux.yml`、`*.AppImage`、`*.AppImage.blockmap` |

可以下载 metadata 文件并检查其中的 `path` / `files.url` 是否能在同一个 Release 中找到对应文件。

---

## 更新源测试

应用默认使用大陆网络更友好的 `ghfast.top` 镜像源。实际访问形式为：

```text
https://ghfast.top/https://github.com/zzzdajb/DickHelper/releases/latest/download/latest.yml
```

GitHub 直连源为：

```text
https://github.com/zzzdajb/DickHelper/releases/latest/download/latest.yml
```

建议在旧版本客户端上分别验证：

1. 设置页选择 **镜像源**，点击检查更新，确认能发现新版本并完成下载。
2. 重新安装旧版本，或在安装更新前切换到 **GitHub 直连**，再次检查更新。

如果当前源失败，应用只会显示错误并提示切换更新源，不会自动回退到另一个源。这是预期行为。

---

## 发布前快速检查

在发 tag 前建议先做这些检查：

```bash
npx tsc -b --noEmit
npm run build
```

完整安装包和 updater metadata 以 GitHub Actions 的 Release workflow 输出为准。Windows 本机运行 `electron-builder` 时可能受符号链接权限影响，遇到本地权限问题时优先以 CI 结果判断。
