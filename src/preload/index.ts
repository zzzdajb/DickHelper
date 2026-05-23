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
};

try {
    contextBridge.exposeInMainWorld("electronAPI", electronAPI);
    console.log("[Preload] electronAPI exposed successfully");
} catch (error) {
    console.error("[Preload] Failed to expose electronAPI:", error);
}
