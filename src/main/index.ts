import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { DatabaseService } from "./database";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let databaseService: DatabaseService | null = null;

// 创建窗口时不显示，等 ready-to-show 再显示，避免白屏闪烁
function CreateWindow(): void {
    mainWindow = new BrowserWindow({
        width: 960,
        height: 680,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: "#f5f5f5",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "../preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });

    // 开发环境加载 dev server URL，生产环境加载打包后的文件
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
    if (!databaseService) return;

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
    databaseService = new DatabaseService();
    RegisterIpcHandlers();
    CreateWindow();
    CreateTray();

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
