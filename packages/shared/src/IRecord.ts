export interface IRecord {
    readonly Id: string;
    readonly StartTime: Date;
    readonly EndTime: Date;
    readonly Duration: number;
    readonly Notes?: string;
}

export interface IRecordRaw {
    readonly Id: string;
    readonly StartTime: string;
    readonly EndTime: string;
    readonly Duration: number;
    readonly Notes: string | null;
}

export interface IStats {
    readonly TotalCount: number;
    readonly AverageDuration: number;
    readonly WeeklyAverageDuration: number;
    readonly FrequencyPerWeek: number;
    readonly FrequencyPerMonth: number;
}

export interface IDailyCount {
    readonly Date: string;
    readonly Count: number;
}

export interface IImportResult {
    readonly Imported: number;
    readonly Skipped: number;
    readonly Rejected: number;
}

// 社区聚合统计
export interface ICommunityStats {
    readonly WeekId: string;
    readonly MedianCount: number;
    readonly MedianDuration: number;
    readonly SampleSize: number;
}

// 应用配置
export interface IAppConfig {
    readonly CommunityOptIn: boolean;
    readonly ContributorId: string | null;
    readonly ApiEndpoint: string;
}
