import { autoUpdater } from "electron-updater";
import type { UpdateInfo, ProgressInfo } from "electron-updater";
import { BrowserWindow, ipcMain, app, shell } from "electron";

// 注意：owner/repo 在 electron-builder.yml 和 src/renderer/views/Settings.tsx 中也有引用
const GITHUB_OWNER: string = "zzzdajb";
const GITHUB_REPO: string = "DickHelper";
const GITHUB_MIRROR: string = "https://ghfast.top/";

const ALLOWED_EXTERNAL_HOSTS: ReadonlySet<string> = new Set(["github.com"]);

// 注意：此接口必须与 src/renderer/types/IRecord.ts#IUpdateStatus 保持同步
interface IUpdateStatusPayload {
    readonly Status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
    readonly Version?: string;
    readonly Progress?: number;
    readonly Error?: string;
    readonly ReleaseNotes?: string;
}

let _isChecking: boolean = false;

function SendUpdateStatus(status: IUpdateStatusPayload): void {
    const win: BrowserWindow | undefined = BrowserWindow.getAllWindows()[0];
    win?.webContents.send("update-status", status);
}

function ConfigureFeedUrl(useMirror: boolean): void {
    if (useMirror) {
        autoUpdater.setFeedURL({
            provider: "generic",
            url: `${GITHUB_MIRROR}https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download`,
        });
    } else {
        autoUpdater.setFeedURL({
            provider: "github",
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
        });
    }
}

export function InitUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
        SendUpdateStatus({ Status: "checking" });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
        let notes: string | undefined;
        const rn: unknown = info.releaseNotes;
        if (typeof rn === "string") {
            notes = rn;
        } else if (Array.isArray(rn)) {
            notes = (rn as Array<{ note?: string | null }>)
                .map((n) => n.note ?? "")
                .filter((s) => s.length > 0)
                .join("\n");
        }

        SendUpdateStatus({
            Status: "available",
            Version: info.version,
            ReleaseNotes: notes,
        });
    });

    autoUpdater.on("update-not-available", () => {
        SendUpdateStatus({ Status: "not-available" });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
        SendUpdateStatus({
            Status: "downloading",
            Progress: Math.round(progress.percent),
        });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
        SendUpdateStatus({
            Status: "downloaded",
            Version: info.version,
        });
    });

    autoUpdater.on("error", (err: Error) => {
        SendUpdateStatus({
            Status: "error",
            Error: err.message,
        });
    });
}

export function RegisterUpdateHandlers(): void {
    ipcMain.handle("updater:check", async (...args) => {
        if (!app.isPackaged) {
            SendUpdateStatus({ Status: "not-available" });
            return null;
        }
        if (_isChecking) return null;
        _isChecking = true;
        try {
            const useMirror: boolean = typeof args[1] === "boolean" ? args[1] : false;
            ConfigureFeedUrl(useMirror);
            const result = await autoUpdater.checkForUpdates();
            return result?.updateInfo ?? null;
        } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : "检查更新失败";
            throw new Error(message);
        } finally {
            _isChecking = false;
        }
    });

    ipcMain.handle("updater:download", async () => {
        if (!app.isPackaged) {
            throw new Error("开发模式不支持自动下载");
        }
        try {
            await autoUpdater.downloadUpdate();
        } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : "下载更新失败";
            throw new Error(message);
        }
    });

    ipcMain.handle("updater:install", () => {
        if (!app.isPackaged) {
            throw new Error("开发模式不支持自动安装");
        }
        autoUpdater.quitAndInstall(false, true);
    });

    ipcMain.handle("updater:get-version", () => {
        return app.getVersion();
    });

    ipcMain.handle("shell:open-external", async (...args) => {
        const url: unknown = args[1];
        if (typeof url !== "string" || url.length === 0) {
            throw new Error("URL 参数无效");
        }
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new Error("URL 格式无效");
        }
        if (parsed.protocol !== "https:") {
            throw new Error("只允许打开 HTTPS 链接");
        }
        if (!ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)) {
            throw new Error(`不允许打开此域名: ${parsed.hostname}`);
        }
        await shell.openExternal(url);
    });
}
