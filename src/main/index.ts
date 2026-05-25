import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import { DatabaseService } from "./database";
import { Analyze as AiAnalyze, type IAiConfig } from "./ai-service";
import { UpdateService } from "./updateService";
import type { IHourlyCount, IMonthlyCount, IWeekdayCount } from "@dickhelper/shared";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let databaseService: DatabaseService | null = null;
let updateService: UpdateService | null = null;
let isQuitting: boolean = false;

const IS_DEV: boolean = process.env.ELECTRON_RENDERER_URL !== undefined;
const ALLOWED_AI_SETTING_KEYS: Set<string> = new Set([
    "ai_provider",
    "ai_api_key",
    "ai_api_endpoint",
    "ai_model",
]);

interface IAiDurationStats {
    Min: number;
    Max: number;
    Avg: number;
    Median: number;
}

interface IAiAnalysisData {
    TotalCount: number;
    AverageDuration: number;
    FrequencyPerWeek: number;
    FrequencyPerMonth: number;
    HourlyDistribution: IHourlyCount[];
    WeekdayDistribution: IWeekdayCount[];
    MonthlyTrend: IMonthlyCount[];
    DurationStats: IAiDurationStats;
}

function BuildMedian(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    const sortedValues: number[] = [...values].sort((a, b) => a - b);
    const middleIndex: number = Math.floor(sortedValues.length / 2);

    if (sortedValues.length % 2 !== 0) {
        return sortedValues[middleIndex]!;
    }

    return (sortedValues[middleIndex - 1]! + sortedValues[middleIndex]!) / 2;
}

function BuildAiAnalysisData(): IAiAnalysisData {
    if (!databaseService) {
        throw new Error("数据库尚未初始化。");
    }

    const stats = databaseService.GetStats();
    const hourlyDistribution = databaseService.GetHourlyDistribution();
    const weekdayDistribution = databaseService.GetWeekdayDistribution();
    const monthlyTrend = databaseService.GetMonthlyTrend();
    const durations = databaseService.GetAllDurations();
    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
        TotalCount: stats.TotalCount,
        AverageDuration: stats.AverageDuration,
        FrequencyPerWeek: stats.FrequencyPerWeek,
        FrequencyPerMonth: stats.FrequencyPerMonth,
        HourlyDistribution: hourlyDistribution,
        WeekdayDistribution: weekdayDistribution,
        MonthlyTrend: monthlyTrend,
        DurationStats: {
            Min: sortedDurations[0] ?? 0,
            Max: sortedDurations[sortedDurations.length - 1] ?? 0,
            Avg: stats.AverageDuration,
            Median: BuildMedian(sortedDurations),
        },
    };
}

function BuildAiConfig(): IAiConfig {
    if (!databaseService) {
        throw new Error("数据库尚未初始化。");
    }

    const rawProvider = databaseService.GetSetting("ai_provider");
    const provider: "openai" | "local" = rawProvider === "openai" ? "openai" : "local";

    return {
        Provider: provider,
        ApiKey: databaseService.GetSetting("ai_api_key") ?? "",
        ApiEndpoint: databaseService.GetSetting("ai_api_endpoint") ?? "https://api.openai.com/v1/chat/completions",
        Model: databaseService.GetSetting("ai_model") ?? "gpt-4o-mini",
    };
}

// 创建窗口时不显示，等 ready-to-show 再显示，避免白屏闪烁
function CreateWindow(): void {
    const preloadPath: string = path.join(__dirname, "../preload/index.cjs");
    console.log("[Main] Creating window, preload path:", preloadPath);
    console.log("[Main] __dirname:", __dirname);
    console.log("[Main] Dev mode:", IS_DEV);

    const iconPath: string = path.join(__dirname, "../../resources/stopwatch.png");

    mainWindow = new BrowserWindow({
        width: 960,
        height: 680,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: "#f5f5f5",
        show: false,
        icon: iconPath,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // 隐藏菜单栏（仅在开发模式下显示）
    if (!IS_DEV) {
        mainWindow.setMenuBarVisibility(false);
    }

    mainWindow.once("ready-to-show", () => {
        console.log("[Main] Window ready-to-show");
        mainWindow?.show();
        // 开发模式自动打开 DevTools
        if (IS_DEV) {
            mainWindow?.webContents.openDevTools();
            console.log("[Main] DevTools opened");
        }
    });

    // 监听页面加载错误
    mainWindow.webContents.on("did-fail-load", (..._args) => {
        const errorCode: number = _args[1] as number;
        const errorDescription: string = _args[2] as string;
        console.error("[Main] Page load failed:", errorCode, errorDescription);
    });

    // 监听控制台消息（渲染进程 console 会转发到这里）
    mainWindow.webContents.on("console-message", (..._args) => {
        const level: number = _args[1] as number;
        const message: string = _args[2] as string;
        const levelNames: string[] = ["verbose", "info", "warning", "error"];
        console.log(`[Renderer ${levelNames[level] ?? level}]`, message);
    });

    // 开发环境加载 dev server URL，生产环境加载打包后的文件
    if (IS_DEV) {
        console.log("[Main] Loading dev URL:", process.env.ELECTRON_RENDERER_URL);
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!);
    } else {
        const filePath: string = path.join(__dirname, "../renderer/index.html");
        console.log("[Main] Loading file:", filePath);
        mainWindow.loadFile(filePath);
    }

    // 关闭窗口时缩到托盘而不是退出
    mainWindow.on("close", (event) => {
        if (tray !== null && !isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}

function CreateTray(): void {
    const iconPath: string = path.join(__dirname, "../../resources/stopwatch.png");
    const icon: Electron.NativeImage = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon);
    tray.setToolTip("牛子小助手");

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "显示",
            click: (): void => {
                mainWindow?.show();
            },
        },
        {
            label: "退出",
            click: (): void => {
                isQuitting = true;
                tray = null;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on("double-click", () => {
        mainWindow?.show();
    });
}

function RegisterIpcHandlers(): void {
    if (!databaseService) {
        console.error("[Main] databaseService is null, skipping IPC registration");
        return;
    }
    console.log("[Main] Registering IPC handlers...");

    ipcMain.handle("records:get-all", () => {
        return databaseService!.GetRecords();
    });

    ipcMain.handle("records:save", (...args) => {
        const startTime: string = args[1] as string;
        const endTime: string = args[2] as string;
        const duration: number = args[3] as number;
        const notes: string | undefined = args[4] as string | undefined;
        const record = databaseService!.SaveRecord(new Date(startTime), new Date(endTime), duration, notes);
        // 通知渲染进程数据已更新
        mainWindow?.webContents.send("records-updated");
        return record;
    });

    ipcMain.handle("records:delete", (...args) => {
        const id: string = args[1] as string;
        const success = databaseService!.DeleteRecord(id);
        if (success) {
            mainWindow?.webContents.send("records-updated");
        }
        return success;
    });

    ipcMain.handle("records:clear-all", () => {
        databaseService!.ClearAll();
        mainWindow?.webContents.send("records-updated");
    });

    ipcMain.handle("records:get-stats", () => {
        return databaseService!.GetStats();
    });

    ipcMain.handle("records:get-daily-counts", (...args) => {
        const startTimestamp: number = args[1] as number;
        const endTimestamp: number = args[2] as number;
        return databaseService!.GetDailyCounts(startTimestamp, endTimestamp);
    });

    ipcMain.handle("records:import", (...args) => {
        const records = args[1] as { Id: string; StartTime?: string; EndTime?: string; Duration: number; Notes?: string }[];
        const result = databaseService!.ImportRecords(records);
        if (result.Imported > 0) {
            mainWindow?.webContents.send("records-updated");
        }
        return result;
    });

    ipcMain.handle("charts:hourly-distribution", () => {
        return databaseService!.GetHourlyDistribution();
    });

    ipcMain.handle("charts:weekday-distribution", () => {
        return databaseService!.GetWeekdayDistribution();
    });

    ipcMain.handle("charts:monthly-trend", () => {
        return databaseService!.GetMonthlyTrend();
    });

    ipcMain.handle("charts:duration-distribution", () => {
        return databaseService!.GetAllDurations();
    });

    ipcMain.handle("settings:get", (_event, key: unknown) => {
        if (typeof key !== "string" || !ALLOWED_AI_SETTING_KEYS.has(key)) {
            throw new Error(`不允许的设置项: ${String(key)}`);
        }

        return databaseService!.GetSetting(key);
    });

    ipcMain.handle("settings:set", (_event, key: unknown, value: unknown) => {
        if (typeof key !== "string" || typeof value !== "string" || !ALLOWED_AI_SETTING_KEYS.has(key)) {
            throw new Error(`不允许的设置项: ${String(key)}`);
        }

        databaseService!.SetSetting(key, value);
    });

    ipcMain.handle("ai:analyze", async () => {
        return AiAnalyze(BuildAiAnalysisData(), BuildAiConfig());
    });

    ipcMain.handle("updates:get-state", () => {
        return updateService!.GetState();
    });

    ipcMain.handle("updates:get-settings", () => {
        return updateService!.GetSettings();
    });

    ipcMain.handle("updates:set-source", (_event, source: string) => {
        return updateService!.SetSource(source);
    });

    ipcMain.handle("updates:check", () => {
        return updateService!.CheckForUpdates();
    });

    ipcMain.handle("updates:download", () => {
        return updateService!.DownloadUpdate();
    });

    ipcMain.handle("updates:install", () => {
        isQuitting = true;
        updateService!.InstallUpdate();
    });

    ipcMain.handle("shell:open-external", (_event, url: string) => {
        return shell.openExternal(url);
    });
}

// 单例锁：禁止多个实例，防止多个托盘图标
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log("[Main] Another instance is running, quitting");
    app.quit();
} else {
    app.on("second-instance", () => {
        // 当用户再次尝试打开应用时，聚焦已有窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        console.log("[Main] App ready");
        databaseService = await DatabaseService.create();
        console.log("[Main] DatabaseService initialized");
        updateService = new UpdateService(() => mainWindow);
        RegisterIpcHandlers();
        CreateWindow();
        CreateTray();
        updateService.StartStartupCheck();
        console.log("[Main] Startup complete");

        app.on("activate", () => {
            // macOS: 点击 dock 图标时重新创建窗口
            if (BrowserWindow.getAllWindows().length === 0) {
                CreateWindow();
            } else {
                mainWindow?.show();
            }
        });
    });
}

// 所有窗口关闭时退出（除了 macOS）
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // 不自动退出，托盘维持运行
    }
});

app.on("before-quit", () => {
    isQuitting = true;
    tray = null;
    databaseService?.Close();
});
