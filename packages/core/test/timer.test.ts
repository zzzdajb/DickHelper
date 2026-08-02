import assert from "node:assert/strict";
import {
    GetTimerElapsedSeconds,
    IDLE_TIMER_STATE,
    IsTimerPaused,
    IsTimerRunning,
    PauseTimer,
    ResumeTimer,
    StartTimer,
    StopTimer,
} from "../src/index";

function RunTest(name: string, fn: () => void): void {
    fn();
    console.log(`✓ ${name}`);
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
// 固定起点，绝不取 Date.now()：整层逻辑的时间全部由参数注入
const START_MS = new Date(2026, 7, 1, 14, 0, 0).getTime();

// --- 状态派生 ---

RunTest("IDLE_TIMER_STATE 既未运行也未暂停", () => {
    assert.equal(IsTimerRunning(IDLE_TIMER_STATE), false);
    assert.equal(IsTimerPaused(IDLE_TIMER_STATE), false);
    assert.equal(GetTimerElapsedSeconds(IDLE_TIMER_STATE, START_MS), 0);
});

RunTest("StartTimer 返回运行中且未暂停的全新状态", () => {
    const state = StartTimer(START_MS);

    assert.equal(state.StartedAtMs, START_MS);
    assert.equal(state.AccumulatedPauseMs, 0);
    assert.equal(state.PausedAtMs, null);
    assert.equal(IsTimerRunning(state), true);
    assert.equal(IsTimerPaused(state), false);
});

// --- 正常开始→结束 ---

RunTest("正常开始→结束的时长为整段时间", () => {
    const state = StartTimer(START_MS);
    const session = StopTimer(state, START_MS + 25 * MINUTE_MS + 30 * SECOND_MS);

    assert.ok(session !== null);
    assert.equal(session.StartTime.getTime(), START_MS);
    assert.equal(session.EndTime.getTime(), START_MS + 25 * MINUTE_MS + 30 * SECOND_MS);
    assert.equal(session.DurationMinutes, 25.5);
});

// 精度行为逐字锁死：历史数据是按 toFixed(2) 存的，改成别的舍入方式会与旧记录不同源
RunTest("时长保留两位小数，第三位按 toFixed 舍入", () => {
    const session = StopTimer(StartTimer(START_MS), START_MS + 100 * SECOND_MS);

    assert.ok(session !== null);
    assert.equal(session.DurationMinutes, 1.67);
});

RunTest("不足一秒的时长不被抹平为 0", () => {
    const session = StopTimer(StartTimer(START_MS), START_MS + 600);

    assert.ok(session !== null);
    assert.equal(session.DurationMinutes, 0.01);
});

// --- 暂停扣除 ---

RunTest("单次暂停从时长中扣除", () => {
    let state = StartTimer(START_MS);
    state = PauseTimer(state, START_MS + 60 * SECOND_MS);
    state = ResumeTimer(state, START_MS + 90 * SECOND_MS);

    const session = StopTimer(state, START_MS + 150 * SECOND_MS);

    assert.ok(session !== null);
    // 墙上时间 150 秒，其中暂停 30 秒，计入 120 秒 = 2 分钟
    assert.equal(session.DurationMinutes, 2);
});

RunTest("多次暂停累加后一并扣除", () => {
    let state = StartTimer(START_MS);
    state = PauseTimer(state, START_MS + 60 * SECOND_MS);
    state = ResumeTimer(state, START_MS + 90 * SECOND_MS);
    state = PauseTimer(state, START_MS + 120 * SECOND_MS);
    state = ResumeTimer(state, START_MS + 165 * SECOND_MS);

    assert.equal(state.AccumulatedPauseMs, 75 * SECOND_MS);

    const session = StopTimer(state, START_MS + 255 * SECOND_MS);

    assert.ok(session !== null);
    // 墙上时间 255 秒，暂停 30 + 45 = 75 秒，计入 180 秒 = 3 分钟
    assert.equal(session.DurationMinutes, 3);
});

RunTest("暂停期间已用秒数停止增长", () => {
    let state = StartTimer(START_MS);
    state = PauseTimer(state, START_MS + 60 * SECOND_MS);

    assert.equal(GetTimerElapsedSeconds(state, START_MS + 60 * SECOND_MS), 60);
    assert.equal(GetTimerElapsedSeconds(state, START_MS + 200 * SECOND_MS), 60);

    state = ResumeTimer(state, START_MS + 200 * SECOND_MS);

    assert.equal(GetTimerElapsedSeconds(state, START_MS + 210 * SECOND_MS), 70);
});

// --- 停止时仍在暂停中 ---

RunTest("停止时仍在暂停中，该段暂停也被扣除", () => {
    let state = StartTimer(START_MS);
    state = PauseTimer(state, START_MS + 60 * SECOND_MS);

    const session = StopTimer(state, START_MS + 180 * SECOND_MS);

    assert.ok(session !== null);
    // 暂停中直接结束：后 120 秒不能算进去，否则时长虚高
    assert.equal(session.DurationMinutes, 1);
});

// --- 未开始时 StopTimer ---

RunTest("未开始时 StopTimer 返回 null", () => {
    assert.equal(StopTimer(IDLE_TIMER_STATE, START_MS), null);
});

// --- 非法状态原样返回 ---

RunTest("未运行时 PauseTimer 原样返回", () => {
    const result = PauseTimer(IDLE_TIMER_STATE, START_MS);

    assert.equal(result, IDLE_TIMER_STATE);
});

RunTest("已暂停时再 PauseTimer 原样返回", () => {
    const paused = PauseTimer(StartTimer(START_MS), START_MS + 60 * SECOND_MS);
    const result = PauseTimer(paused, START_MS + 90 * SECOND_MS);

    assert.equal(result, paused);
});

RunTest("未运行时 ResumeTimer 原样返回", () => {
    const result = ResumeTimer(IDLE_TIMER_STATE, START_MS);

    assert.equal(result, IDLE_TIMER_STATE);
});

RunTest("未暂停时 ResumeTimer 原样返回", () => {
    const running = StartTimer(START_MS);
    const result = ResumeTimer(running, START_MS + 60 * SECOND_MS);

    assert.equal(result, running);
});

RunTest("PauseTimer 不改动传入的状态对象", () => {
    const running = StartTimer(START_MS);
    PauseTimer(running, START_MS + 60 * SECOND_MS);

    assert.equal(running.PausedAtMs, null);
    assert.equal(running.AccumulatedPauseMs, 0);
});

// --- 时钟回跳 ---

RunTest("时钟回跳时已用秒数为 0 而非负数", () => {
    const state = StartTimer(START_MS);

    assert.equal(GetTimerElapsedSeconds(state, START_MS - 5 * SECOND_MS), 0);
});

// 暂停中回跳不需要单独兜底：公式里 now 自然相消，已用秒数恒等于暂停那一刻的值
RunTest("暂停中时钟回跳时已用秒数冻结在暂停时刻的值", () => {
    const state = PauseTimer(StartTimer(START_MS), START_MS + 60 * SECOND_MS);

    assert.equal(GetTimerElapsedSeconds(state, START_MS - 60 * SECOND_MS), 60);
});

// 暂停期间发生回跳会让累计暂停时长超过墙上时间，这是下限保护真正拦住的场景
RunTest("累计暂停超过墙上时间时已用秒数为 0", () => {
    let state = StartTimer(START_MS);
    state = PauseTimer(state, START_MS + 10 * SECOND_MS);
    state = ResumeTimer(state, START_MS + 40 * SECOND_MS);

    assert.equal(state.AccumulatedPauseMs, 30 * SECOND_MS);
    assert.equal(GetTimerElapsedSeconds(state, START_MS + 10 * SECOND_MS), 0);
});

console.log("packages/core timer tests passed");
