import type { IRecord } from "@dickhelper/shared";

const DAY_MS = 86_400_000;

// 统计卡片的滚动窗口长度；界面文案也从这里取，避免文案与实现各写各的天数
export const LAST_7_DAYS: number = 7;
export const LAST_30_DAYS: number = 30;

// 月度趋势的跨度：主进程据此取数、渲染进程据此写文案，两侧必须同源
export const MONTHLY_TREND_MONTHS: number = 12;

export function GetWindowStart(now: Date, days: number): Date {
    return new Date(now.getTime() - days * DAY_MS);
}

export function CountInWindow(records: readonly IRecord[], now: Date, days: number): number {
    const windowStart = GetWindowStart(now, days);

    let count = 0;
    for (const record of records) {
        // 恰好落在窗口起点的记录计入，与桌面端 SQL 的 EndTime >= ? 同一边界
        if (record.EndTime >= windowStart) {
            count++;
        }
    }
    return count;
}
