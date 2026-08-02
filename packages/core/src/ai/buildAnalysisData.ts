import type { IRecord } from "@dickhelper/shared";
import type { IAiAnalysisData } from "./ai.types";
import { CountInWindow, LAST_7_DAYS, LAST_30_DAYS } from "../statsWindow";

const DAY_MS = 86_400_000;

export function BuildAnalysisData(records: readonly IRecord[]): IAiAnalysisData {
    if (records.length === 0) {
        return {
            TotalCount: 0,
            AverageDuration: 0,
            RecordSpanDays: 0,
            Last7DayCount: 0,
            Last30DayCount: 0,
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
    let earliestEndTime: number = Number.POSITIVE_INFINITY;
    let latestEndTime: number = Number.NEGATIVE_INFINITY;

    // 分布一律按本地时区切分，与 database.ts 的桌面端图表保持同一基准；用户看的是自己墙上的钟
    for (const record of records) {
        durations.push(record.Duration);

        // 调用方不保证记录已排序，所以两端都在循环里取，不额外遍历
        const endTimeMs = record.EndTime.getTime();
        if (endTimeMs < earliestEndTime) {
            earliestEndTime = endTimeMs;
        }
        if (endTimeMs > latestEndTime) {
            latestEndTime = endTimeMs;
        }

        const hour = record.EndTime.getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);

        const weekday = (record.EndTime.getDay() + 6) % 7; // Monday=0, Sunday=6
        weekdayMap.set(weekday, (weekdayMap.get(weekday) ?? 0) + 1);

        const monthKey = FormatMonthKey(record.EndTime.getFullYear(), record.EndTime.getMonth());
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1);
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const totalDuration = Sum(durations);

    return {
        TotalCount: records.length,
        AverageDuration: totalDuration / records.length,
        // 用实际经过时间而非日历日，避开时区与夏令时
        RecordSpanDays: Math.floor((latestEndTime - earliestEndTime) / DAY_MS),
        Last7DayCount: CountInWindow(records, now, LAST_7_DAYS),
        Last30DayCount: CountInWindow(records, now, LAST_30_DAYS),
        HourlyDistribution: BuildHourlyDistribution(hourlyMap),
        WeekdayDistribution: BuildWeekdayDistribution(weekdayMap),
        MonthlyTrend: BuildMonthlyTrend(monthlyMap, earliestEndTime, latestEndTime, now),
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

// 若只列有记录的月份，「1 月 5 次」就会紧挨着「5 月 3 次」，与「连续两个月在下降」无从区分，所以空月补 0
function BuildMonthlyTrend(
    map: Map<string, number>,
    earliestEndTime: number,
    latestEndTime: number,
    now: Date,
): readonly { readonly Month: string; readonly Count: number }[] {
    const earliest = new Date(earliestEndTime);
    const latest = new Date(latestEndTime);

    // 终点取当前月与最晚记录月里较晚的那个：用户改过系统时间或导入了未来时间戳时，最晚那条记录不能从趋势里消失
    const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const latestMonthStart = new Date(latest.getFullYear(), latest.getMonth(), 1);
    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonthStart = latestMonthStart > nowMonthStart ? latestMonthStart : nowMonthStart;

    const result: { readonly Month: string; readonly Count: number }[] = [];
    while (cursor.getTime() <= endMonthStart.getTime()) {
        const monthKey = FormatMonthKey(cursor.getFullYear(), cursor.getMonth());
        result.push({ Month: monthKey, Count: map.get(monthKey) ?? 0 });
        // 日固定为 1，setMonth 的跨年进位是安全的，不会算出 13 月
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
}

function FormatMonthKey(year: number, monthZeroBased: number): string {
    return `${year}-${String(monthZeroBased + 1).padStart(2, "0")}`;
}
