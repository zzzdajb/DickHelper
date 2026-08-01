export interface IDurationStats {
    readonly Min: number;
    readonly Max: number;
    readonly Avg: number;
    readonly Median: number;
}

export interface IAiAnalysisData {
    readonly TotalCount: number;
    readonly AverageDuration: number;
    readonly Last7DayCount: number;
    readonly Last30DayCount: number;
    readonly HourlyDistribution: readonly { readonly Hour: number; readonly Count: number }[];
    readonly WeekdayDistribution: readonly { readonly Weekday: number; readonly Count: number }[];
    readonly MonthlyTrend: readonly { readonly Month: string; readonly Count: number }[];
    readonly DurationStats: IDurationStats;
}

export interface IAiConfig {
    readonly Provider: "openai" | "local";
    readonly ApiEndpoint: string;
    readonly ApiKey: string;
    readonly Model: string;
}
