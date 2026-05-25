import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IUpdateSettings, IUpdateState, UpdateSource } from "@dickhelper/shared";

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
    GetHourlyDistribution: (): Promise<unknown[]> => ipcRenderer.invoke("charts:hourly-distribution"),
    GetWeekdayDistribution: (): Promise<unknown[]> => ipcRenderer.invoke("charts:weekday-distribution"),
    GetMonthlyTrend: (): Promise<unknown[]> => ipcRenderer.invoke("charts:monthly-trend"),
    GetDurationDistribution: (): Promise<number[]> => ipcRenderer.invoke("charts:duration-distribution"),
    GetSetting: (key: string): Promise<string | null> => ipcRenderer.invoke("settings:get", key),
    SetSetting: (key: string, value: string): Promise<void> => ipcRenderer.invoke("settings:set", key, value),
    RequestAiAnalysis: (): Promise<string> => ipcRenderer.invoke("ai:analyze"),
    GetUpdateState: (): Promise<IUpdateState> => ipcRenderer.invoke("updates:get-state"),
    GetUpdateSettings: (): Promise<IUpdateSettings> => ipcRenderer.invoke("updates:get-settings"),
    SetUpdateSource: (source: UpdateSource): Promise<IUpdateSettings> => ipcRenderer.invoke("updates:set-source", source),
    CheckForUpdates: (): Promise<IUpdateState> => ipcRenderer.invoke("updates:check"),
    DownloadUpdate: (): Promise<IUpdateState> => ipcRenderer.invoke("updates:download"),
    InstallUpdate: (): Promise<void> => ipcRenderer.invoke("updates:install"),
    OnRecordsUpdated: (callback: () => void): (() => void) => {
        const listener = (): void => callback();
        ipcRenderer.on("records-updated", listener);
        return () => {
            ipcRenderer.removeListener("records-updated", listener);
        };
    },
    OnUpdateStateChanged: (callback: (state: IUpdateState) => void): (() => void) => {
        const listener = (_event: IpcRendererEvent, state: IUpdateState): void => callback(state);
        ipcRenderer.on("updates:state-changed", listener);
        return () => {
            ipcRenderer.removeListener("updates:state-changed", listener);
        };
    },
    OpenExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:open-external", url),
};

try {
    contextBridge.exposeInMainWorld("electronAPI", electronAPI);
    console.log("[Preload] electronAPI exposed successfully");
} catch (error) {
    console.error("[Preload] Failed to expose electronAPI:", error);
}
