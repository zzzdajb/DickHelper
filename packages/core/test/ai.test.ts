import assert from "node:assert/strict";
import type { IRecord } from "@dickhelper/shared";
import type { IAiConfig } from "../src/index";
import {
    ANALYSIS_SYSTEM_PROMPT,
    MIN_RECORDS_FOR_FREQUENCY_VERDICT,
    MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT,
    NO_DATA_MESSAGE,
    Analyze,
    BuildAnalysisData,
    AnalyzeLocally,
    BuildPrompt,
} from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

async function RunTestAsync(name: string, fn: () => Promise<void>): Promise<void> {
    await fn();
    console.log(`✓ ${name}`);
}

const DAY_MS = 86_400_000;

// --- BuildAnalysisData boundary tests ---

RunTest("BuildAnalysisData returns zeroed stats for empty records", () => {
    const result = BuildAnalysisData([]);

    assert.equal(result.TotalCount, 0);
    assert.equal(result.AverageDuration, 0);
    assert.equal(result.Last7DayCount, 0);
    assert.equal(result.Last30DayCount, 0);
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

    // 趋势从记录所在月一直补到当前月，所以只断言该月自己的计数，不断言序列长度
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
    assert.equal(result.MonthlyTrend[0]?.Month, "2026-05");
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

RunTest("BuildAnalysisData reports zero span for empty and single-record input", () => {
    assert.equal(BuildAnalysisData([]).RecordSpanDays, 0);

    const single: IRecord[] = [CreateRecordWithDuration("r1", new Date(2026, 4, 10, 10, 0, 0), 15)];
    assert.equal(BuildAnalysisData(single).RecordSpanDays, 0);
});

// 传入顺序刻意反着给：调用方不保证记录已排序，跨度不能依赖顺序
RunTest("BuildAnalysisData computes record span in whole days regardless of order", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("late", new Date(baseTime.getTime() + 20 * DAY_MS), 20),
        CreateRecordWithDuration("early", baseTime, 15),
    ];

    assert.equal(BuildAnalysisData(records).RecordSpanDays, 20);
});

RunTest("BuildAnalysisData floors partial days in record span", () => {
    const baseTime = new Date(2026, 4, 10, 10, 0, 0);
    const records: IRecord[] = [
        CreateRecordWithDuration("r1", baseTime, 15),
        CreateRecordWithDuration("r2", new Date(baseTime.getTime() + 3 * DAY_MS - 60_000), 20),
    ];

    assert.equal(BuildAnalysisData(records).RecordSpanDays, 2);
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

// 若只列有记录的月份，「1 月 5 次」紧挨「5 月 3 次」会被读成连续下降，所以中间的空月必须补 0
RunTest("BuildAnalysisData fills empty months between the earliest record and now", () => {
    const records: IRecord[] = [
        CreateRecordMonthsAgo("old", 4),
        CreateRecordMonthsAgo("new", 0),
    ];

    const trend = BuildAnalysisData(records).MonthlyTrend;

    assert.equal(trend.length, 5);
    assert.equal(trend[0]?.Month, MonthKeyMonthsAgo(4));
    assert.equal(trend[0]?.Count, 1);
    for (const monthsAgo of [3, 2, 1]) {
        const slot = trend.find((item) => item.Month === MonthKeyMonthsAgo(monthsAgo));
        assert.ok(slot !== undefined, `month ${MonthKeyMonthsAgo(monthsAgo)} should be listed`);
        assert.equal(slot.Count, 0);
    }
    assert.equal(trend[trend.length - 1]?.Month, MonthKeyMonthsAgo(0));
    assert.equal(trend[trend.length - 1]?.Count, 1);
});

RunTest("BuildAnalysisData extends the monthly trend to the current month when recent months are empty", () => {
    const trend = BuildAnalysisData([CreateRecordMonthsAgo("only", 3)]).MonthlyTrend;

    assert.equal(trend.length, 4);
    assert.equal(trend[0]?.Count, 1);
    for (const monthsAgo of [2, 1, 0]) {
        const slot = trend.find((item) => item.Month === MonthKeyMonthsAgo(monthsAgo));
        assert.ok(slot !== undefined, `month ${MonthKeyMonthsAgo(monthsAgo)} should be listed`);
        assert.equal(slot.Count, 0);
    }
    assert.equal(trend[trend.length - 1]?.Month, MonthKeyMonthsAgo(0));
});

// 跨 13 个月必然含一次年末进位，用来盯住「2025-13」这类非法月份
RunTest("BuildAnalysisData rolls the year over instead of emitting a 13th month", () => {
    const records: IRecord[] = [
        CreateRecordMonthsAgo("old", 13),
        CreateRecordMonthsAgo("new", 0),
    ];

    const trend = BuildAnalysisData(records).MonthlyTrend;

    assert.equal(trend.length, 14);
    for (const item of trend) {
        assert.ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(item.Month), `illegal month key: ${item.Month}`);
    }

    const decemberIndex = trend.findIndex((item) => item.Month.endsWith("-12"));
    assert.ok(decemberIndex >= 0 && decemberIndex < trend.length - 1);
    const decemberYear = Number(trend[decemberIndex]!.Month.slice(0, 4));
    assert.equal(trend[decemberIndex + 1]?.Month, `${decemberYear + 1}-01`);
});

// 用户改过系统时间或导入了未来时间戳时，最晚那条记录不能从趋势里消失
RunTest("BuildAnalysisData keeps records dated after the current month in the trend", () => {
    const records: IRecord[] = [
        CreateRecordMonthsAgo("past", 1),
        CreateRecordMonthsAgo("future", -2),
    ];

    const trend = BuildAnalysisData(records).MonthlyTrend;

    assert.equal(trend.length, 4);
    assert.equal(trend[0]?.Month, MonthKeyMonthsAgo(1));
    assert.equal(trend[trend.length - 1]?.Month, MonthKeyMonthsAgo(-2));
    assert.equal(trend[trend.length - 1]?.Count, 1);

    const currentMonth = trend.find((item) => item.Month === MonthKeyMonthsAgo(0));
    assert.ok(currentMonth !== undefined);
    assert.equal(currentMonth.Count, 0);
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

// 同一个 App 里本地分析劝诫、API 分析中立，用户切一下 Provider 就能看到这个口吻差异
RunTest("AnalyzeLocally reports the high-frequency bucket without preaching", () => {
    const now = new Date();
    const records: IRecord[] = [];
    for (let index = 0; index < 9; index++) {
        records.push(CreateRecordWithDuration(`recent-${index}`, new Date(now.getTime() - index * 3_600_000), 15));
    }

    const data = BuildAnalysisData(records);
    assert.ok(data.Last7DayCount > 7);

    const result = AnalyzeLocally(data);
    assert.ok(result.includes("偏高"));
    for (const word of ["建议", "控制", "节制", "克制", "应该"]) {
        assert.ok(!result.includes(word), `local analysis should not preach: ${word}`);
    }
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
    assert.ok(prompt.includes("记录跨度：1 天"));
    assert.ok(prompt.includes("高峰时段"));
    assert.ok(prompt.includes("星期分布"));
    assert.ok(prompt.includes("时长统计"));
    assert.ok(prompt.includes("月度趋势"));
    assert.ok(prompt.includes("请描述这些数据反映出的行为模式"));
    assert.ok(prompt.includes("观察式建议"));
    assert.ok(prompt.includes("不要劝我改变什么"));
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

// 24 个整点是补齐出来的，混进「高峰」就等于请模型点评从未发生过的时段
RunTest("BuildPrompt lists only hours that actually occurred", () => {
    const records: IRecord[] = [
        CreateRecordAtHour("r1", 9),
        CreateRecordAtHour("r2", 9),
        CreateRecordAtHour("r3", 21),
    ];
    const prompt = BuildPrompt(BuildAnalysisData(records));

    assert.ok(prompt.includes("9:00：2 次"));
    assert.ok(prompt.includes("21:00：1 次"));
    assert.ok(!prompt.includes(":00：0 次"));
});

// 星期只有 7 个槽位且是完整分布，「周二：0 次」本身有信息量，与补齐出来的整点不同，零值刻意保留
RunTest("BuildPrompt keeps all seven weekday slots including zeros", () => {
    const prompt = BuildPrompt(BuildAnalysisData([CreateRecordAtHour("r1", 9)]));

    const weekdayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    for (const name of weekdayNames) {
        assert.ok(prompt.includes(`${name}：`), `weekday ${name} should be listed`);
    }

    // 单条记录只落在一个星期上，其余六天必然是 0
    const zeroWeekdays = weekdayNames.filter((name) => prompt.includes(`${name}：0 次`));
    assert.equal(zeroWeekdays.length, 6);
});

// Prompt 自己带一堆「- 」列表，就等于示范了 system 里明令禁止的 Markdown
RunTest("BuildPrompt keeps the data section free of Markdown markers", () => {
    const prompt = BuildPrompt(BuildAnalysisData(CreateRecordsSpanningDays(12, 30)));

    for (const marker of ["*", "#", "`", "|"]) {
        assert.ok(!prompt.includes(marker), `prompt should not contain ${marker}`);
    }

    for (const line of prompt.split("\n")) {
        assert.ok(!line.trim().startsWith("-"), `line should not start with a list marker: ${line}`);
    }

    // 月份里的短横线是数据值，不是列表符号，去掉会破坏数据
    assert.ok(/\n {2}\d{4}-\d{2}：\d+ 次/.test(prompt));
});

// slice(-6) 只有在序列连续时才等于「最近 6 个自然月」，空档必须原样出现在 Prompt 里
RunTest("BuildPrompt shows empty months as zero in the monthly trend", () => {
    const records: IRecord[] = [
        CreateRecordMonthsAgo("old", 2),
        CreateRecordMonthsAgo("new", 0),
    ];
    const prompt = BuildPrompt(BuildAnalysisData(records));

    assert.ok(prompt.includes(`${MonthKeyMonthsAgo(2)}：1 次`));
    assert.ok(prompt.includes(`${MonthKeyMonthsAgo(1)}：0 次`));
    assert.ok(prompt.includes(`${MonthKeyMonthsAgo(0)}：1 次`));
    assert.ok(prompt.includes("没有记录的月份为 0 次"));
});

// 记录不满 6 个月时表头不能声称给了 6 个月，否则模型会以为有月份被漏掉
RunTest("BuildPrompt does not claim six months when fewer exist", () => {
    const prompt = BuildPrompt(BuildAnalysisData([CreateRecordMonthsAgo("only", 0)]));

    const trendSection = prompt.slice(prompt.indexOf("月度趋势"), prompt.indexOf("请描述"));
    const monthLines = trendSection.split("\n").filter((line) => /^ {2}\d{4}-\d{2}：/.test(line));
    assert.equal(monthLines.length, 1);
    assert.ok(prompt.includes("最多列最近 6 个月"));
});

RunTest("BuildPrompt withholds a frequency verdict when record count is short", () => {
    const data = BuildAnalysisData(CreateRecordsSpanningDays(MIN_RECORDS_FOR_FREQUENCY_VERDICT - 1, 30));

    assert.equal(data.TotalCount, MIN_RECORDS_FOR_FREQUENCY_VERDICT - 1);
    assert.ok(data.RecordSpanDays >= MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT);

    const prompt = BuildPrompt(data);
    assert.ok(prompt.includes("只描述观察到的模式"));
    assert.ok(prompt.includes("不要对频率高低下任何结论"));
    assert.ok(!prompt.includes("偏多、正常还是偏少"));
    assert.ok(!prompt.includes("这一项是必答的"));
});

RunTest("BuildPrompt withholds a frequency verdict when record span is short", () => {
    const data = BuildAnalysisData(
        CreateRecordsSpanningDays(MIN_RECORDS_FOR_FREQUENCY_VERDICT + 5, MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT - 1),
    );

    assert.ok(data.TotalCount >= MIN_RECORDS_FOR_FREQUENCY_VERDICT);
    assert.equal(data.RecordSpanDays, MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT - 1);

    const prompt = BuildPrompt(data);
    assert.ok(prompt.includes("只描述观察到的模式"));
    assert.ok(!prompt.includes("偏多、正常还是偏少"));
});

RunTest("BuildPrompt demands a frequency verdict once data is sufficient", () => {
    const data = BuildAnalysisData(CreateRecordsSpanningDays(20, 60));

    const prompt = BuildPrompt(data);
    assert.ok(prompt.includes("必须给出一个方向性判断"));
    assert.ok(prompt.includes("偏多、正常还是偏少"));
    assert.ok(prompt.includes("因人而异"));
    assert.ok(prompt.includes("建议咨询专业人士"));
    assert.ok(prompt.includes("请描述这些数据反映出的行为模式"));
    assert.ok(prompt.includes("观察式建议"));
    assert.ok(!prompt.includes("只描述观察到的模式"));
});

// 门槛是 >= 而非 >，恰好踩线的数据必须算充足
RunTest("BuildPrompt treats the exact threshold as sufficient data", () => {
    const data = BuildAnalysisData(
        CreateRecordsSpanningDays(MIN_RECORDS_FOR_FREQUENCY_VERDICT, MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT),
    );

    assert.equal(data.TotalCount, MIN_RECORDS_FOR_FREQUENCY_VERDICT);
    assert.equal(data.RecordSpanDays, MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT);

    const prompt = BuildPrompt(data);
    assert.ok(prompt.includes("偏多、正常还是偏少"));
    assert.ok(!prompt.includes("只描述观察到的模式"));
});

// 只断言整句会被改写措辞绕过：真正要守的是方向性标记词一个都不许漏进门槛内那套，否则「不下结论」形同虚设
RunTest("BuildPrompt keeps the two threshold instructions vocabulary-disjoint", () => {
    const short = BuildPrompt(BuildAnalysisData(CreateRecordsSpanningDays(3, 5)));
    for (const word of ["偏多", "偏少", "方向性"]) {
        assert.ok(!short.includes(word), `门槛内的指令不该出现方向性标记词「${word}」`);
    }

    const enough = BuildPrompt(BuildAnalysisData(CreateRecordsSpanningDays(20, 60)));
    for (const word of ["样本量还不够", "只描述", "不要对频率高低下任何结论"]) {
        assert.ok(!enough.includes(word), `门槛外的指令不该出现回避判断的措辞「${word}」`);
    }
});

// --- System prompt tests ---

RunTest("ANALYSIS_SYSTEM_PROMPT states what is being recorded", () => {
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("自慰"));
});

RunTest("ANALYSIS_SYSTEM_PROMPT constrains tone", () => {
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("中立"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("不做道德评判"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("不说教"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("不要建议用户就医"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("咨询任何专业人士"));
});

// 两端都是纯文本渲染，Markdown 符号会原样显示成裸露的星号井号
RunTest("ANALYSIS_SYSTEM_PROMPT forbids Markdown and constrains layout", () => {
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("Markdown"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("只输出纯文本"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("段落之间空一行"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("同一段落内部不要换行"));
    assert.ok(ANALYSIS_SYSTEM_PROMPT.includes("400 字"));
});

// system 文本自己就不该出现 Markdown 符号，否则模型会照着输入的样子输出
RunTest("ANALYSIS_SYSTEM_PROMPT itself contains no Markdown markers", () => {
    // system 里没有任何数据值，所以短横线也一并禁掉
    for (const marker of ["*", "#", "`", "|", "-"]) {
        assert.ok(!ANALYSIS_SYSTEM_PROMPT.includes(marker), `system prompt should not contain ${marker}`);
    }
});

// --- Analyze routing tests ---

await RunTestAsync("Analyze returns the shared empty-state message without any request", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (): Promise<Response> => {
        throw new Error("Analyze 在 0 条记录时不应该发起请求");
    };

    try {
        const data = BuildAnalysisData([]);
        const config: IAiConfig = {
            Provider: "openai",
            ApiEndpoint: "https://example.invalid/v1/chat/completions",
            ApiKey: "unused",
            Model: "o3-mini",
        };

        const result = await Analyze(data, config);

        assert.equal(result, NO_DATA_MESSAGE);
        assert.ok(result.includes("暂无数据记录"));
        // 短路文案与本地分析必须是同一份，不允许两处各写一个字符串
        assert.equal(result, AnalyzeLocally(data));
    } finally {
        globalThis.fetch = originalFetch;
    }
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

// 首尾两条相距恰好 spanDays 天，中间的记录均匀铺开，用来踩门槛边界
function CreateRecordsSpanningDays(count: number, spanDays: number): IRecord[] {
    const baseTime = new Date(2026, 0, 5, 21, 0, 0);
    const totalSpanMs = spanDays * DAY_MS;

    const records: IRecord[] = [];
    for (let index = 0; index < count; index++) {
        // 整毫秒取整，避免浮点余数让首尾跨度少一天，把边界测试测歪
        const offsetMs = count > 1 ? Math.round((index * totalSpanMs) / (count - 1)) : 0;
        records.push(CreateRecordWithDuration(`span-${index}`, new Date(baseTime.getTime() + offsetMs), 15 + index));
    }
    return records;
}

// 补齐的终点是「当前月份」，写死日期到了明年就跑不过，所以一律基于 new Date() 相对推算
function CreateRecordMonthsAgo(id: string, monthsAgo: number): IRecord {
    const now = new Date();
    // 日固定为 1：跨月推算不会碰到 31 号溢出
    return CreateRecordWithDuration(id, new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1, 21, 0, 0), 20);
}

function MonthKeyMonthsAgo(monthsAgo: number): string {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
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
