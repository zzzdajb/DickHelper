// 声明 window.electronAPI 类型，让渲染进程可以直接使用
import type { IRecordRaw, IStats, IDailyCount, IImportResult, IUpdateSettings, IUpdateState, UpdateSource } from "@dickhelper/shared";

interface IImportRecord {
    Id: string;
    StartTime?: string;
    EndTime?: string;
    Duration: number;
    Notes?: string;
}

declare global {
    interface Window {
        electronAPI: {
            GetRecords: () => Promise<IRecordRaw[]>;
            SaveRecord: (startTime: string, endTime: string, duration: number, notes?: string) => Promise<IRecordRaw>;
            DeleteRecord: (id: string) => Promise<boolean>;
            ClearAll: () => Promise<void>;
            GetStats: () => Promise<IStats>;
            GetDailyCounts: (startTimestamp: number, endTimestamp: number) => Promise<IDailyCount[]>;
            ImportRecords: (records: IImportRecord[]) => Promise<IImportResult>;
            GetUpdateState: () => Promise<IUpdateState>;
            GetUpdateSettings: () => Promise<IUpdateSettings>;
            SetUpdateSource: (source: UpdateSource) => Promise<IUpdateSettings>;
            CheckForUpdates: () => Promise<IUpdateState>;
            DownloadUpdate: () => Promise<IUpdateState>;
            InstallUpdate: () => Promise<void>;
            OnRecordsUpdated: (callback: () => void) => () => void;
            OnUpdateStateChanged: (callback: (state: IUpdateState) => void) => () => void;
            OpenExternal: (url: string) => Promise<boolean>;
        };
    }
}

export {};
