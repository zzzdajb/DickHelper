// 声明 window.electronAPI 类型，让渲染进程可以直接使用

interface IRecordRaw {
    readonly Id: string;
    readonly StartTime: string;
    readonly EndTime: string;
    readonly Duration: number;
    readonly Notes?: string | null;
}

interface IStats {
    readonly TotalCount: number;
    readonly AverageDuration: number;
    readonly FrequencyPerWeek: number;
    readonly FrequencyPerMonth: number;
}

interface IDailyCount {
    readonly Date: string;
    readonly Count: number;
}

interface IImportResult {
    readonly Imported: number;
    readonly Skipped: number;
    readonly Rejected: number;
}

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
            GetDailyCounts: (startDate: string, endDate: string) => Promise<IDailyCount[]>;
            ImportRecords: (records: IImportRecord[]) => Promise<IImportResult>;
            OnRecordsUpdated: (callback: () => void) => () => void;
        };
    }
}

export {};
