import assert from "node:assert/strict";
import type { IRecord } from "@dickhelper/shared";
import { BuildAnalysisData, AnalyzeLocally, BuildPrompt } from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

const DAY_MS = 86_400_000;

// --- BuildAnalysisData boundary tests ---

RunTest("BuildAnalysisData returns zeroed stats for empty records", () => {
    const result = BuildAnalysisData([]);

    assert.equal(result.TotalCount, 0);
    assert.equal(result.AverageDuration, 0);
    assert.equal(result.FrequencyPerWeek, 0);
    assert.equal(result.FrequencyPerMonth, 0);
    assert.equal(result.HourlyDistribution.length, 24);
    assert.equal(result.WeekdayDistribution.length, 7);
    assert.equal(result.MonthlyTrend.length, 0);
    assert.equal(result.DurationStats.Min, 0);
    assert.equal(result.DurationStats.Max, 0);
    assert.equal(result.DurationStats.Avg, 0);
    assert.equal(result.DurationStats.Median, 0);

    for (const slot of result.HourlyDistribution) {
        assert.equal(slot.Count, 0);
    }
    for (const slot of result.WeekdayDistribution) {
        assert.equal(slot.Count, 0);
    }
});

RunTest("BuildAnalysisData handles single record", () => {
    const now = new Date(2026, 4, 15, 14, 30, 0);
    const records: IRecord[] = [
        {
            Id: "single-1",
            StartTime: new Date(now.getTime() - 30 * 60 * 1000),
            EndTime: now,
            Duration: 30,
        },
    ];

    const result = BuildAnalysisData(records);

    assert.equal(result.TotalCount, 1);
    assert.equal(result.AverageDuration, 30);
    assert.equal(result.DurationStats.Min, 30);
    assert.equal(result.DurationStats.Max, 30);
    assert.equal(result.DurationStats.Avg, 30);
    assert.equal(result.DurationStats.Median, 30);

    // The record's EndTime is at local hour 14, so that slot should be 1
    const hour14 = result.HourlyDistribution.find((h) => h.Hour === 14);
    assert.ok(hour14 !== undefined);
    assert.equal(hour14.Count, 1);

    assert.equal(result.MonthlyTrend.length, 1);
    assert.equal(result.MonthlyTrend[0]?.Month, "2026-05");
    assert.equal(result.MonthlyTrend[0]?.Count, 1);
});

RunTest("BuildAnalysisData handles multiple records with varied durations", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("r1", baseTime, 20),
        CreateRecordWithDuration("r2", new Date(baseTime.getTime() + DAY_MS), 40),
        CreateRecordWithDuration("r3", new Date(baseTime.getTime() + 2 * DAY_MS), 60),
    ];

    const result = BuildAnalysisData(records);

    assert.equal(result.TotalCount, 3);
    assert.equal(result.AverageDuration, 40);
    assert.equal(result.DurationStats.Min, 20);
    assert.equal(result.DurationStats.Max, 60);
    assert.equal(result.DurationStats.Median, 40);
    assert.equal(result.MonthlyTrend.length, 1);
    assert.equal(result.MonthlyTrend[0]?.Count, 3);
});

RunTest("BuildAnalysisData computes median correctly for even count", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("r1", baseTime, 10),
        CreateRecordWithDuration("r2", new Date(baseTime.getTime() + DAY_MS), 20),
        CreateRecordWithDuration("r3", new Date(baseTime.getTime() + 2 * DAY_MS), 30),
        CreateRecordWithDuration("r4", new Date(baseTime.getTime() + 3 * DAY_MS), 40),
    ];

    const result = BuildAnalysisData(records);

    assert.equal(result.DurationStats.Median, 25);
});

RunTest("BuildAnalysisData populates all 24 hourly slots", () => {
    const records: IRecord[] = [
        CreateRecordAtHour("r1", 0),
        CreateRecordAtHour("r2", 12),
        CreateRecordAtHour("r3", 23),
    ];

    const result = BuildAnalysisData(records);

    assert.equal(result.HourlyDistribution.length, 24);
    assert.equal(result.HourlyDistribution[0]?.Count, 1);
    assert.equal(result.HourlyDistribution[12]?.Count, 1);
    assert.equal(result.HourlyDistribution[23]?.Count, 1);
    assert.equal(result.HourlyDistribution[6]?.Count, 0);
});

// --- AnalyzeLocally tests ---

RunTest("AnalyzeLocally returns empty-state message for no data", () => {
    const data = BuildAnalysisData([]);
    const result = AnalyzeLocally(data);

    assert.ok(result.includes("暂无数据记录"));
});

RunTest("AnalyzeLocally produces insights for populated data", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("r1", baseTime, 15),
        CreateRecordWithDuration("r2", new Date(baseTime.getTime() + DAY_MS), 20),
        CreateRecordWithDuration("r3", new Date(baseTime.getTime() + 2 * DAY_MS), 25),
    ];
    const data = BuildAnalysisData(records);
    const result = AnalyzeLocally(data);

    assert.ok(result.includes("高峰时段"));
    assert.ok(result.includes("持续时长范围"));
    assert.ok(result.includes("平均时长"));
});

// --- BuildPrompt tests ---

RunTest("BuildPrompt includes key data sections", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("r1", baseTime, 15),
        CreateRecordWithDuration("r2", new Date(baseTime.getTime() + DAY_MS), 20),
    ];
    const data = BuildAnalysisData(records);
    const prompt = BuildPrompt(data);

    assert.ok(prompt.includes("统计概览"));
    assert.ok(prompt.includes("总次数：2"));
    assert.ok(prompt.includes("高峰时段"));
    assert.ok(prompt.includes("星期分布"));
    assert.ok(prompt.includes("时长统计"));
    assert.ok(prompt.includes("月度趋势"));
    assert.ok(prompt.includes("请分析"));
});

RunTest("BuildPrompt formats hourly peaks correctly", () => {
    const records: IRecord[] = [
        CreateRecordAtHour("r1", 9),
        CreateRecordAtHour("r2", 9),
        CreateRecordAtHour("r3", 21),
    ];
    const data = BuildAnalysisData(records);
    const prompt = BuildPrompt(data);

    // Hour 9 should appear as the top peak with 2 count
    assert.ok(prompt.includes("9:00：2 次"));
});

console.log("packages/core AI tests passed");

// --- Helpers ---

function CreateRecordWithDuration(id: string, endTime: Date, durationMinutes: number): IRecord {
    return {
        Id: id,
        StartTime: new Date(endTime.getTime() - durationMinutes * 60 * 1000),
        EndTime: new Date(endTime),
        Duration: durationMinutes,
    };
}

// 一律构造本地时间：分布统计按本地时区切分，用 UTC 字面量会让断言与实现同号相消、测不出时区错位
function CreateRecordAtHour(id: string, hour: number): IRecord {
    const endTime = new Date(2026, 4, 15, hour, 0, 0);
    return {
        Id: id,
        StartTime: new Date(endTime.getTime() - 15 * 60 * 1000),
        EndTime: endTime,
        Duration: 15,
    };
}
