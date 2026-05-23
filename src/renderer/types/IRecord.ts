export interface IRecord {
    readonly Id: string;
    readonly StartTime: Date;
    readonly EndTime: Date;
    readonly Duration: number;
    readonly Notes?: string;
}

// 从 SQLite 读取时的原始数据（日期为 ISO 字符串）
export interface IRecordRaw {
    readonly Id: string;
    readonly StartTime: string;
    readonly EndTime: string;
    readonly Duration: number;
    readonly Notes?: string;
}

// 统计数据结构
export interface IStats {
    readonly TotalCount: number;
    readonly AverageDuration: number;
    readonly FrequencyPerWeek: number;
    readonly FrequencyPerMonth: number;
}

// 每日计数（用于热力图）
export interface IDailyCount {
    readonly Date: string;
    readonly Count: number;
}

// 导入结果
export interface IImportResult {
    readonly Imported: number;
    readonly Skipped: number;
    readonly Rejected: number;
}
