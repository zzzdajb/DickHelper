import assert from "node:assert/strict";
import type { IRecord } from "@dickhelper/shared";
import { CountInWindow, GetWindowStart, LAST_7_DAYS, LAST_30_DAYS } from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 7, 1, 14, 0, 0);

RunTest("窗口天数常量与字段名承诺的天数一致", () => {
    assert.equal(LAST_7_DAYS, 7);
    assert.equal(LAST_30_DAYS, 30);
});

RunTest("GetWindowStart 返回 now 之前整 N 天", () => {
    assert.equal(NOW.getTime() - GetWindowStart(NOW, LAST_7_DAYS).getTime(), 7 * DAY_MS);
    assert.equal(NOW.getTime() - GetWindowStart(NOW, LAST_30_DAYS).getTime(), 30 * DAY_MS);
});

RunTest("CountInWindow 对空记录返回 0", () => {
    assert.equal(CountInWindow([], NOW, LAST_30_DAYS), 0);
});

RunTest("CountInWindow 只统计窗口内的记录", () => {
    const records: IRecord[] = [
        CreateRecordDaysAgo("in-1", 0),
        CreateRecordDaysAgo("in-2", 3),
        CreateRecordDaysAgo("in-3", 6.9),
        CreateRecordDaysAgo("out-1", 8),
        CreateRecordDaysAgo("out-2", 40),
    ];

    assert.equal(CountInWindow(records, NOW, LAST_7_DAYS), 3);
    assert.equal(CountInWindow(records, NOW, LAST_30_DAYS), 4);
});

// 边界符必须与桌面端 SQL 的 EndTime >= ? 一致，否则同一份数据三端会差 1
RunTest("恰好落在窗口起点的记录计入", () => {
    const atStart: IRecord[] = [CreateRecordAt("edge", GetWindowStart(NOW, LAST_30_DAYS))];
    assert.equal(CountInWindow(atStart, NOW, LAST_30_DAYS), 1);
});

RunTest("早于窗口起点 1 毫秒的记录不计入", () => {
    const justBefore = new Date(GetWindowStart(NOW, LAST_30_DAYS).getTime() - 1);
    assert.equal(CountInWindow([CreateRecordAt("edge", justBefore)], NOW, LAST_30_DAYS), 0);
});

// 滚动窗口是本次口径调整的目的：自然月在月初会塌到接近 0
RunTest("月初时滚动 30 天远多于自然月至今", () => {
    const firstOfMonth = new Date(2026, 7, 1, 14, 0, 0);
    const records: IRecord[] = [];
    for (let back = 0; back < 40; back++) {
        records.push(CreateRecordDaysAgo(`r${back}`, back, firstOfMonth));
    }

    const monthStart = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1);
    let calendarMonthToDate = 0;
    for (const record of records) {
        if (record.EndTime >= monthStart) {
            calendarMonthToDate++;
        }
    }

    // 31 而非 30：第 0 天到第 30 天共 31 条，其中第 30 天那条恰好落在窗口起点、按设计计入
    assert.equal(calendarMonthToDate, 1);
    assert.equal(CountInWindow(records, firstOfMonth, LAST_30_DAYS), 31);
});

console.log("packages/core statsWindow tests passed");

// --- Helpers ---

function CreateRecordAt(id: string, endTime: Date): IRecord {
    return {
        Id: id,
        StartTime: new Date(endTime.getTime() - 15 * 60 * 1000),
        EndTime: endTime,
        Duration: 15,
    };
}

function CreateRecordDaysAgo(id: string, days: number, from: Date = NOW): IRecord {
    return CreateRecordAt(id, new Date(from.getTime() - days * DAY_MS));
}
