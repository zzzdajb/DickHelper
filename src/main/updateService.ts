import { app, type BrowserWindow } from "electron";
import electronUpdater, {
    type AppUpdater,
    type ProgressInfo,
    type UpdateDownloadedEvent,
    type UpdateInfo,
} from "electron-updater";
import { CancellationToken } from "builder-util-runtime";
import fs from "node:fs";
import path from "node:path";
import type { IUpdateSettings, IUpdateState, UpdateSource, UpdateStatus } from "../shared/IUpdate";

interface IUpdateConfig {
    Source: UpdateSource;
}

const DEFAULT_SOURCE: UpdateSource = "mirror";
const UPDATE_CONFIG_FILE_NAME = "update-settings.json";
const DIRECT_UPDATE_FEED_URL = "https://github.com/zzzdajb/DickHelper/releases/latest/download/";
const MIRROR_UPDATE_FEED_URL = `https://ghfast.top/${DIRECT_UPDATE_FEED_URL}`;

export class UpdateService {
    private readonly _autoUpdater: AppUpdater;
    private readonly _configPath: string;
    private readonly _getMainWindow: () => BrowserWindow | null;
    private _source: UpdateSource;
    private _state: IUpdateState;
    private _downloadCancellationToken: CancellationToken | null = null;
    private _downloadOperationId: number = 0;

    public constructor(getMainWindow: () => BrowserWindow | null) {
        const { autoUpdater } = electronUpdater;
        this._autoUpdater = autoUpdater;
        this._configPath = path.join(app.getPath("userData"), UPDATE_CONFIG_FILE_NAME);
        this._getMainWindow = getMainWindow;
        this._source = this.LoadSource();
        this._state = this.CreateState("idle");

        this.ConfigureUpdater();
        this.RegisterUpdaterEvents();

        if (!app.isPackaged) {
            this.UpdateState({ Status: "disabled", ErrorMessage: "开发模式不检查更新" });
        }
    }

    public GetState(): IUpdateState {
        return { ...this._state };
    }

    public GetSettings(): IUpdateSettings {
        return {
            Source: this._source,
            FeedUrl: this.GetFeedUrl(this._source),
        };
    }

    public SetSource(source: string): IUpdateSettings {
        const nextSource = this.ParseSource(source);
        this.CancelDownload();
        this._source = nextSource;
        this.SaveConfig();
        this.ConfigureFeedUrl();

        const status: UpdateStatus = app.isPackaged ? "idle" : "disabled";
        this.UpdateState({
            Status: status,
            Source: nextSource,
            AvailableVersion: null,
            DownloadProgress: null,
            ErrorMessage: app.isPackaged ? null : "开发模式不检查更新",
        });

        return this.GetSettings();
    }

    public StartStartupCheck(): void {
        if (!app.isPackaged) {
            return;
        }

        void this.CheckForUpdates();
    }

    public async CheckForUpdates(): Promise<IUpdateState> {
        if (!app.isPackaged) {
            this.UpdateState({ Status: "disabled", ErrorMessage: "开发模式不检查更新" });
            return this.GetState();
        }

        if (this._state.IsChecking || this._state.IsDownloading) {
            return this.GetState();
        }

        this.ConfigureFeedUrl();
        this.UpdateState({
            Status: "checking",
            AvailableVersion: null,
            DownloadProgress: null,
            ErrorMessage: null,
        });

        try {
            await this._autoUpdater.checkForUpdates();
        } catch (error) {
            this.UpdateState({
                Status: "error",
                ErrorMessage: this.FormatError(error),
            });
        }

        return this.GetState();
    }

    public async DownloadUpdate(): Promise<IUpdateState> {
        if (!app.isPackaged) {
            this.UpdateState({ Status: "disabled", ErrorMessage: "开发模式不检查更新" });
            return this.GetState();
        }

        if (!this._state.IsUpdateAvailable || this._state.IsDownloading) {
            return this.GetState();
        }

        this.UpdateState({
            Status: "downloading",
            DownloadProgress: 0,
            ErrorMessage: null,
        });

        const operationId = ++this._downloadOperationId;
        const cancellationToken = new CancellationToken();
        this._downloadCancellationToken = cancellationToken;

        try {
            await this._autoUpdater.downloadUpdate(cancellationToken);
        } catch (error) {
            if (operationId === this._downloadOperationId && !this.IsCancellationError(error)) {
                this.UpdateState({
                    Status: "error",
                    ErrorMessage: this.FormatError(error),
                });
            }
        } finally {
            if (operationId === this._downloadOperationId) {
                cancellationToken.dispose();
                this._downloadCancellationToken = null;
            }
        }

        return this.GetState();
    }

    public InstallUpdate(): void {
        if (!this._state.IsUpdateDownloaded) {
            return;
        }

        this._autoUpdater.quitAndInstall(false, true);
    }

    private ConfigureUpdater(): void {
        this._autoUpdater.autoDownload = false;
        this._autoUpdater.autoInstallOnAppQuit = false;
        this._autoUpdater.allowPrerelease = false;
        this.ConfigureFeedUrl();
    }

    private ConfigureFeedUrl(): void {
        this._autoUpdater.setFeedURL({
            provider: "generic",
            url: this.GetFeedUrl(this._source),
        });
    }

    private RegisterUpdaterEvents(): void {
        this._autoUpdater.on("checking-for-update", () => {
            this.UpdateState({ Status: "checking", ErrorMessage: null });
        });

        this._autoUpdater.on("update-available", (info: UpdateInfo) => {
            this.UpdateState({
                Status: "available",
                AvailableVersion: info.version,
                DownloadProgress: null,
                ErrorMessage: null,
            });
        });

        this._autoUpdater.on("update-not-available", () => {
            this.UpdateState({
                Status: "not-available",
                AvailableVersion: null,
                DownloadProgress: null,
                ErrorMessage: null,
            });
        });

        this._autoUpdater.on("download-progress", (progress: ProgressInfo) => {
            this.UpdateState({
                Status: "downloading",
                DownloadProgress: Math.round(progress.percent),
                ErrorMessage: null,
            });
        });

        this._autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
            this.UpdateState({
                Status: "downloaded",
                AvailableVersion: event.version,
                DownloadProgress: 100,
                ErrorMessage: null,
            });
        });

        this._autoUpdater.on("error", (error: Error) => {
            if (this.IsCancellationError(error)) {
                return;
            }

            this.UpdateState({
                Status: "error",
                ErrorMessage: this.FormatError(error),
            });
        });
    }

    private UpdateState(nextState: Partial<IUpdateState>): void {
        const status: UpdateStatus = nextState.Status ?? this._state.Status;
        const source: UpdateSource = nextState.Source ?? this._source;

        this._state = {
            ...this._state,
            ...nextState,
            Status: status,
            Source: source,
            CurrentVersion: app.getVersion(),
            IsChecking: status === "checking",
            IsUpdateAvailable: status === "available",
            IsDownloading: status === "downloading",
            IsUpdateDownloaded: status === "downloaded",
        };

        this.SendState();
    }

    private SendState(): void {
        const mainWindow = this._getMainWindow();

        if (mainWindow === null || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.webContents.send("updates:state-changed", this.GetState());
    }

    private CreateState(status: UpdateStatus): IUpdateState {
        return {
            Status: status,
            Source: this._source,
            CurrentVersion: app.getVersion(),
            AvailableVersion: null,
            DownloadProgress: null,
            ErrorMessage: null,
            IsChecking: status === "checking",
            IsUpdateAvailable: status === "available",
            IsDownloading: status === "downloading",
            IsUpdateDownloaded: status === "downloaded",
        };
    }

    private GetFeedUrl(source: UpdateSource): string {
        if (source === "github") {
            return DIRECT_UPDATE_FEED_URL;
        }

        return MIRROR_UPDATE_FEED_URL;
    }

    private LoadSource(): UpdateSource {
        if (!fs.existsSync(this._configPath)) {
            return DEFAULT_SOURCE;
        }

        try {
            const rawText = fs.readFileSync(this._configPath, "utf-8");
            const rawConfig = JSON.parse(rawText) as Partial<IUpdateConfig>;
            return this.ParseSource(rawConfig.Source);
        } catch {
            return DEFAULT_SOURCE;
        }
    }

    private SaveConfig(): void {
        const config: IUpdateConfig = { Source: this._source };
        fs.writeFileSync(this._configPath, JSON.stringify(config, null, 2), "utf-8");
    }

    private ParseSource(source: unknown): UpdateSource {
        if (source === "github" || source === "mirror") {
            return source;
        }

        return DEFAULT_SOURCE;
    }

    private CancelDownload(): void {
        if (this._downloadCancellationToken === null) {
            return;
        }

        this._downloadOperationId++;
        this._downloadCancellationToken.cancel();
        this._downloadCancellationToken.dispose();
        this._downloadCancellationToken = null;
    }

    private FormatError(error: unknown): string {
        if (error instanceof Error && error.message.trim().length > 0) {
            return `${error.message}。可在设置中切换更新源后重试。`;
        }

        return "检查更新失败。可在设置中切换更新源后重试。";
    }

    private IsCancellationError(error: unknown): boolean {
        return error instanceof Error && error.message === "cancelled";
    }
}
