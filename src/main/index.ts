import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { DatabaseService } from "./database";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let databaseService: DatabaseService | null = null;

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
        const startDate: string = args[1] as string;
        const endDate: string = args[2] as string;
        return databaseService!.GetDailyCounts(startDate, endDate);
    });

    ipcMain.handle("records:import", (...args) => {
        const records = args[1] as { Id: string; StartTime?: string; EndTime?: string; Duration: number; Notes?: string }[];
        const result = databaseService!.ImportRecords(records);
        if (result.Imported > 0) {
            mainWindow?.webContents.send("records-updated");
        }
        return result;
    });
}

app.whenReady().then(() => {
    console.log("[Main] App ready");
    databaseService = new DatabaseService();
    console.log("[Main] DatabaseService initialized");
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
