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

export interface IHourlyCount {
    readonly Hour: number;
    readonly Count: number;
}

export interface IWeekdayCount {
    readonly Weekday: number;
    readonly Count: number;
}

export interface IMonthlyCount {
    readonly Month: string;
    readonly Count: number;
}
