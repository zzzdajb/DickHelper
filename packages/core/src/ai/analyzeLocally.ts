import type { IAiAnalysisData } from "./ai.types";
import { LAST_7_DAYS } from "../statsWindow";

const WEEKDAY_NAMES: readonly string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 本地分析与 API 路径的 0 条记录兜底共用这一句，别在两处各写一份
export const NO_DATA_MESSAGE: string = "暂无数据记录，开始记录后即可获得分析洞察。";

export function AnalyzeLocally(data: IAiAnalysisData): string {
    if (data.TotalCount === 0) {
        return NO_DATA_MESSAGE;
    }

    const insights: string[] = [];

    const peakHours = [...data.HourlyDistribution]
        .filter((item) => item.Count > 0)
        .sort((a, b) => b.Count - a.Count);
    if (peakHours.length > 0) {
        const top = peakHours[0]!;
        const period = top.Hour < 6 ? "凌晨" : top.Hour < 12 ? "上午" : top.Hour < 18 ? "下午" : "晚上";
        insights.push(`高峰时段主要集中在${period} ${String(top.Hour).padStart(2, "0")}:00 附近，最高为 ${top.Count} 次。`);
    }

    let peakDay: { Weekday: number; Count: number } | undefined;
    for (const item of data.WeekdayDistribution) {
        if (peakDay === undefined || item.Count > peakDay.Count) {
            peakDay = item;
        }
    }
    if (peakDay !== undefined && peakDay.Count > 0) {
        insights.push(`星期分布最活跃的是${WEEKDAY_NAMES[peakDay.Weekday] ?? "?"}，共有 ${peakDay.Count} 次。`);
    }

    // 分档照旧给，但只报水平不加建议：同一个 App 里本地分析的口吻必须和 API 那侧的 system prompt 一致，不劝诫
    const last7DayCount = data.Last7DayCount;
    if (last7DayCount <= 3) {
        insights.push(`近 ${LAST_7_DAYS} 天 ${last7DayCount} 次，整体偏平稳。`);
    } else if (last7DayCount <= 7) {
        insights.push(`近 ${LAST_7_DAYS} 天 ${last7DayCount} 次，处于中等水平。`);
    } else {
        insights.push(`近 ${LAST_7_DAYS} 天 ${last7DayCount} 次，处于偏高水平。`);
    }

    insights.push(`持续时长范围约 ${data.DurationStats.Min.toFixed(1)} - ${data.DurationStats.Max.toFixed(1)} 分钟。`);
    insights.push(`平均时长 ${data.DurationStats.Avg.toFixed(1)} 分钟，中位数 ${data.DurationStats.Median.toFixed(1)} 分钟。`);

    const recentMonths = data.MonthlyTrend.slice(-2);
    if (recentMonths.length === 2) {
        const previous = recentMonths[0]!;
        const latest = recentMonths[1]!;
        if (latest.Count > previous.Count) {
            insights.push(`近期趋势上升：${latest.Month} 比 ${previous.Month} 增加了 ${latest.Count - previous.Count} 次。`);
        } else if (latest.Count < previous.Count) {
            insights.push(`近期趋势下降：${latest.Month} 比 ${previous.Month} 减少了 ${previous.Count - latest.Count} 次。`);
        } else {
            insights.push(`近期趋势稳定：${previous.Month} 和 ${latest.Month} 次数相同。`);
        }
    }

    return insights.join("\n\n");
}
