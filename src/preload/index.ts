import { contextBridge, ipcRenderer } from "electron";

console.log("[Preload] Script loading...");

// 暴露给渲染进程的 API
const electronAPI = {
    GetRecords: (): Promise<unknown[]> => ipcRenderer.invoke("records:get-all"),
    SaveRecord: (startTime: string, endTime: string, duration: number, notes?: string): Promise<unknown> =>
        ipcRenderer.invoke("records:save", startTime, endTime, duration, notes),
    DeleteRecord: (id: string): Promise<boolean> => ipcRenderer.invoke("records:delete", id),
    ClearAll: (): Promise<void> => ipcRenderer.invoke("records:clear-all"),
    GetStats: (): Promise<unknown> => ipcRenderer.invoke("records:get-stats"),
    GetDailyCounts: (startTimestamp: number, endTimestamp: number): Promise<unknown[]> =>
        ipcRenderer.invoke("records:get-daily-counts", startTimestamp, endTimestamp),
    ImportRecords: (records: unknown[]): Promise<unknown> => ipcRenderer.invoke("records:import", records),
    OnRecordsUpdated: (callback: () => void): (() => void) => {
        const listener = (): void => callback();
        ipcRenderer.on("records-updated", listener);
        return () => {
            ipcRenderer.removeListener("records-updated", listener);
        };
    },
    // 配置
    GetConfig: (): Promise<unknown> => ipcRenderer.invoke("config:get"),
    SetConfig: (partial: { CommunityOptIn?: boolean }): Promise<unknown> => ipcRenderer.invoke("config:set", partial),
    // 社区统计
    GetCommunityStats: (): Promise<unknown> => ipcRenderer.invoke("community:get-stats"),
    SubmitCommunityStats: (): Promise<boolean> => ipcRenderer.invoke("community:submit"),
    // 设置
    GetSetting: (key: string): Promise<string | null> => ipcRenderer.invoke("settings:get", key),
    SetSetting: (key: string, value: string): Promise<void> => ipcRenderer.invoke("settings:set", key, value),
    // 外部链接
    OpenExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:open-external", url),
    // 自动更新
    CheckForUpdates: (useMirror: boolean): Promise<unknown> => ipcRenderer.invoke("updater:check", useMirror),
    DownloadUpdate: (): Promise<void> => ipcRenderer.invoke("updater:download"),
    InstallUpdate: (): Promise<void> => ipcRenderer.invoke("updater:install"),
    GetAppVersion: (): Promise<string> => ipcRenderer.invoke("updater:get-version"),
    OnUpdateStatus: (callback: (status: unknown) => void): (() => void) => {
        const listener = (...listenerArgs: unknown[]): void => { callback(listenerArgs[1]); };
        ipcRenderer.on("update-status", listener as Parameters<typeof ipcRenderer.on>[1]);
        return () => {
            ipcRenderer.removeListener("update-status", listener as Parameters<typeof ipcRenderer.removeListener>[1]);
        };
    },
};

try {
    contextBridge.exposeInMainWorld("electronAPI", electronAPI);
    console.log("[Preload] electronAPI exposed successfully");
} catch (error) {
    console.error("[Preload] Failed to expose electronAPI:", error);
}
