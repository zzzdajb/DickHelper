// 声明 window.electronAPI 类型，让渲染进程可以直接使用
import type { IRecordRaw, IStats, IDailyCount, IImportResult, ICommunityStats, IAppConfig, IHourlyCount, IWeekdayCount, IMonthlyCount } from "../renderer/types/IRecord";

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
            OnRecordsUpdated: (callback: () => void) => () => void;
            GetConfig: () => Promise<IAppConfig>;
            SetConfig: (partial: { CommunityOptIn?: boolean }) => Promise<IAppConfig>;
            GetCommunityStats: () => Promise<ICommunityStats | null>;
            SubmitCommunityStats: () => Promise<boolean>;
        };
    }
}

export {};
