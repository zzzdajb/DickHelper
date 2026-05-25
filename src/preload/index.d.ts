// 声明 window.electronAPI 类型，让渲染进程可以直接使用
import type {
    IRecordRaw,
    IStats,
    IDailyCount,
    IImportResult,
    IUpdateSettings,
    IUpdateState,
    UpdateSource,
    IHourlyCount,
    IWeekdayCount,
    IMonthlyCount,
} from "@dickhelper/shared";

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
            GetHourlyDistribution: () => Promise<IHourlyCount[]>;
            GetWeekdayDistribution: () => Promise<IWeekdayCount[]>;
            GetMonthlyTrend: () => Promise<IMonthlyCount[]>;
            GetDurationDistribution: () => Promise<number[]>;
            GetSetting: (key: string) => Promise<string | null>;
            SetSetting: (key: string, value: string) => Promise<void>;
            RequestAiAnalysis: () => Promise<string>;
            GetUpdateState: () => Promise<IUpdateState>;
            GetUpdateSettings: () => Promise<IUpdateSettings>;
            SetUpdateSource: (source: UpdateSource) => Promise<IUpdateSettings>;
            CheckForUpdates: () => Promise<IUpdateState>;
            DownloadUpdate: () => Promise<IUpdateState>;
            InstallUpdate: () => Promise<void>;
            OnRecordsUpdated: (callback: () => void) => () => void;
            OnUpdateStateChanged: (callback: (state: IUpdateState) => void) => () => void;
            OpenExternal: (url: string) => Promise<void>;
        };
    }
}

export {};
