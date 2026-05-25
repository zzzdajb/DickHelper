import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { DatabaseService } from "./database";
import { ConfigService } from "./config";
import { CommunityService, GetCurrentWeekId } from "./community";
import { Analyze as AiAnalyze } from "./ai-service";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let databaseService: DatabaseService | null = null;
let configService: ConfigService | null = null;
let communityService: CommunityService | null = null;

const IS_DEV: boolean = process.env.ELECTRON_RENDERER_URL !== undefined;

// 创建窗口时不显示，等 ready-to-show 再显示，避免白屏闪烁
function CreateWindow(): void {
    const preloadPath: string = path.join(__dirname, "../preload/index.cjs");
    console.log("[Main] Creating window, preload path:", preloadPath);
    console.log("[Main] __dirname:", __dirname);
    console.log("[Main] Dev mode:", IS_DEV);

    mainWindow = new BrowserWindow({
        width: 960,
        height: 680,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: "#f5f5f5",
        show: false,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

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
        if (tray !== null) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}

function CreateTray(): void {
    // 16x16 蓝色方块占位图标 (#2196f3)
    const icon = nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQnPaZJMQwqmFUw/DVAACnNaoQK5bsTwAAAABJRU5ErkJggg=="
    );

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

    // 配置相关
    ipcMain.handle("config:get", () => {
        return configService!.GetConfig();
    });

    ipcMain.handle("config:set", (...args) => {
        const partial = args[1] as { CommunityOptIn?: boolean };
        return configService!.SetConfig(partial);
    });

    // 社区统计相关
    ipcMain.handle("community:get-stats", async () => {
        const weekId: string = GetCurrentWeekId();
        return communityService!.GetCommunityStats(weekId);
    });

    ipcMain.handle("community:submit", async () => {
        const config = configService!.GetConfig();
        if (!config.CommunityOptIn || config.ContributorId === null) {
            return false;
        }
        const weeklyStats = databaseService!.GetWeeklyStats();
        const weekId: string = GetCurrentWeekId();
        return communityService!.SubmitStats(
            config.ContributorId,
            weekId,
            weeklyStats.Count,
            weeklyStats.AvgDuration
        );
    });

    // 图表数据通道
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

    // 设置通道（API Key 使用系统加密存储，仅允许白名单内的 key）
    const ALLOWED_SETTINGS: Set<string> = new Set([
        "ai_provider", "ai_api_key", "ai_ollama_url", "ai_ollama_model",
        "ai_google_model", "ai_cli_command",
    ]);

    ipcMain.handle("settings:get", (...args) => {
        const key: string = args[1] as string;
        if (!ALLOWED_SETTINGS.has(key)) {
            throw new Error(`不允许的设置项: ${key}`);
        }
        if (key === "ai_api_key") {
            return databaseService!.GetSecureSetting(key);
        }
        return databaseService!.GetSetting(key);
    });

    ipcMain.handle("settings:set", (...args) => {
        const key: string = args[1] as string;
        const value: string = args[2] as string;
        if (!ALLOWED_SETTINGS.has(key)) {
            throw new Error(`不允许的设置项: ${key}`);
        }
        if (key === "ai_api_key") {
            databaseService!.SetSecureSetting(key, value);
        } else {
            databaseService!.SetSetting(key, value);
        }
    });

    // AI 分析通道：主进程聚合数据并调用 AI
    ipcMain.handle("ai:analyze", async () => {
        const db = databaseService!;
        const stats = db.GetStats();
        const hourly = db.GetHourlyDistribution();
        const weekday = db.GetWeekdayDistribution();
        const monthly = db.GetMonthlyTrend();
        const durations = db.GetAllDurations();

        const sorted = [...durations].sort((a, b) => a - b);
        const mid: number = Math.floor(sorted.length / 2);
        const median: number = sorted.length === 0
            ? 0
            : sorted.length % 2 !== 0
                ? sorted[mid]!
                : (sorted[mid - 1]! + sorted[mid]!) / 2;
        const durationStats = {
            Min: sorted[0] ?? 0,
            Max: sorted[sorted.length - 1] ?? 0,
            Avg: stats.AverageDuration,
            Median: median,
        };

        // 验证 provider 值，非法值回退到 local
        const validProviders = ["anthropic", "openai", "google", "ollama", "cli", "local"] as const;
        const rawProvider: string = db.GetSetting("ai_provider") ?? "local";
        const provider = (validProviders as readonly string[]).includes(rawProvider)
            ? rawProvider as typeof validProviders[number]
            : "local";
        const config = {
            Provider: provider,
            ApiKey: db.GetSecureSetting("ai_api_key") ?? "",
            OllamaUrl: db.GetSetting("ai_ollama_url") ?? "http://localhost:11434",
            OllamaModel: db.GetSetting("ai_ollama_model") ?? "llama3",
            GoogleModel: db.GetSetting("ai_google_model") ?? "gemini-2.0-flash",
            CliCommand: db.GetSetting("ai_cli_command") ?? "claude -p",
        };

        try {
            return await AiAnalyze(
                { ...stats, HourlyDistribution: hourly, WeekdayDistribution: weekday, MonthlyTrend: monthly, DurationStats: durationStats },
                config
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "分析失败";
            throw new Error(message.length > 200 ? message.slice(0, 200) + "..." : message);
        }
    });
}

app.whenReady().then(async () => {
    console.log("[Main] App ready");
    databaseService = await DatabaseService.create();
    console.log("[Main] DatabaseService initialized");
    configService = new ConfigService();
    communityService = new CommunityService(configService.GetConfig().ApiEndpoint);
    console.log("[Main] ConfigService & CommunityService initialized");
    RegisterIpcHandlers();
    CreateWindow();
    CreateTray();
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

// 所有窗口关闭时退出（除了 macOS）
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // 不自动退出，托盘维持运行
    }
});

app.on("before-quit", () => {
    tray = null;
    databaseService?.Close();
});
