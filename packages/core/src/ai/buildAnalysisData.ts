import type { IRecord } from "@dickhelper/shared";
import type { IAiAnalysisData } from "./ai.types";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function BuildAnalysisData(records: readonly IRecord[]): IAiAnalysisData {
    if (records.length === 0) {
        return {
            TotalCount: 0,
            AverageDuration: 0,
            FrequencyPerWeek: 0,
            FrequencyPerMonth: 0,
            HourlyDistribution: BuildEmptyHourlyDistribution(),
            WeekdayDistribution: BuildEmptyWeekdayDistribution(),
            MonthlyTrend: [],
            DurationStats: { Min: 0, Max: 0, Avg: 0, Median: 0 },
        };
    }

    const now = new Date();
    const durations: number[] = [];
    const hourlyMap = new Map<number, number>();
    const weekdayMap = new Map<number, number>();
    const monthlyMap = new Map<string, number>();

    // 分布一律按本地时区切分，与 database.ts 的桌面端图表保持同一基准；用户看的是自己墙上的钟
    for (const record of records) {
        durations.push(record.Duration);

        const hour = record.EndTime.getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);

        const weekday = (record.EndTime.getDay() + 6) % 7; // Monday=0, Sunday=6
        weekdayMap.set(weekday, (weekdayMap.get(weekday) ?? 0) + 1);

        const monthKey = `${record.EndTime.getFullYear()}-${String(record.EndTime.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1);
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const totalDuration = Sum(durations);
    const weekStart = new Date(now.getTime() - WEEK_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let recentWeek = 0;
    let recentMonth = 0;
    for (const record of records) {
        if (record.EndTime >= weekStart) {
            recentWeek++;
        }
        if (record.EndTime >= monthStart) {
            recentMonth++;
        }
    }

    return {
        TotalCount: records.length,
        AverageDuration: totalDuration / records.length,
        FrequencyPerWeek: recentWeek,
        FrequencyPerMonth: recentMonth,
        HourlyDistribution: BuildHourlyDistribution(hourlyMap),
        WeekdayDistribution: BuildWeekdayDistribution(weekdayMap),
        MonthlyTrend: BuildMonthlyTrend(monthlyMap),
        DurationStats: {
            Min: sortedDurations[0] ?? 0,
            Max: sortedDurations[sortedDurations.length - 1] ?? 0,
            Avg: totalDuration / records.length,
            Median: GetMedian(sortedDurations),
        },
    };
}

function Sum(values: readonly number[]): number {
    let total = 0;
    for (const value of values) {
        total += value;
    }
    return total;
}

function GetMedian(sortedValues: readonly number[]): number {
    if (sortedValues.length === 0) {
        return 0;
    }

    const middleIndex = Math.floor(sortedValues.length / 2);

    if (sortedValues.length % 2 !== 0) {
        return sortedValues[middleIndex] ?? 0;
    }

    return ((sortedValues[middleIndex - 1] ?? 0) + (sortedValues[middleIndex] ?? 0)) / 2;
}

function BuildEmptyHourlyDistribution(): readonly { readonly Hour: number; readonly Count: number }[] {
    const result: { readonly Hour: number; readonly Count: number }[] = [];
    for (let hour = 0; hour < 24; hour++) {
        result.push({ Hour: hour, Count: 0 });
    }
    return result;
}

function BuildEmptyWeekdayDistribution(): readonly { readonly Weekday: number; readonly Count: number }[] {
    const result: { readonly Weekday: number; readonly Count: number }[] = [];
    for (let day = 0; day < 7; day++) {
        result.push({ Weekday: day, Count: 0 });
    }
    return result;
}

function BuildHourlyDistribution(map: Map<number, number>): readonly { readonly Hour: number; readonly Count: number }[] {
    const result: { readonly Hour: number; readonly Count: number }[] = [];
    for (let hour = 0; hour < 24; hour++) {
        result.push({ Hour: hour, Count: map.get(hour) ?? 0 });
    }
    return result;
}

function BuildWeekdayDistribution(map: Map<number, number>): readonly { readonly Weekday: number; readonly Count: number }[] {
    const result: { readonly Weekday: number; readonly Count: number }[] = [];
    for (let day = 0; day < 7; day++) {
        result.push({ Weekday: day, Count: map.get(day) ?? 0 });
    }
    return result;
}

function BuildMonthlyTrend(map: Map<string, number>): readonly { readonly Month: string; readonly Count: number }[] {
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([month, count]) => ({ Month: month, Count: count }));
}
