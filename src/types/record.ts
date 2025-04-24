export interface MasturbationRecord {
    id: string;
    startTime: Date;
    duration: number; // 持续时间（分钟）
    notes?: string; // 可选的备注
}

export interface MasturbationStats {
    totalCount: number;
    averageDuration: number;
    frequencyPerWeek: number;
    frequencyPerMonth: number;
}