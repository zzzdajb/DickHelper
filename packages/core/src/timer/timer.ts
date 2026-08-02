import type { ITimerSession, ITimerState } from "./timer.types";

// 「现在」一律由调用方以 nowMs 传入，本文件不调用 Date.now()，否则这层就无法被纯测试覆盖
export const IDLE_TIMER_STATE: ITimerState = {
    StartedAtMs: null,
    AccumulatedPauseMs: 0,
    PausedAtMs: null,
};

export function IsTimerRunning(state: ITimerState): boolean {
    return state.StartedAtMs !== null;
}

export function IsTimerPaused(state: ITimerState): boolean {
    return state.PausedAtMs !== null;
}

export function StartTimer(nowMs: number): ITimerState {
    return {
        StartedAtMs: nowMs,
        AccumulatedPauseMs: 0,
        PausedAtMs: null,
    };
}

// 非法状态原样返回而不抛错：调用方是按钮事件，重复点击不该炸掉界面
export function PauseTimer(state: ITimerState, nowMs: number): ITimerState {
    if (!IsTimerRunning(state) || IsTimerPaused(state)) {
        return state;
    }

    return { ...state, PausedAtMs: nowMs };
}

export function ResumeTimer(state: ITimerState, nowMs: number): ITimerState {
    if (!IsTimerRunning(state) || state.PausedAtMs === null) {
        return state;
    }

    return {
        ...state,
        AccumulatedPauseMs: state.AccumulatedPauseMs + (nowMs - state.PausedAtMs),
        PausedAtMs: null,
    };
}

export function StopTimer(state: ITimerState, nowMs: number): ITimerSession | null {
    if (state.StartedAtMs === null) {
        return null;
    }

    const totalPausedMs = GetTotalPausedMs(state, nowMs);

    return {
        StartTime: new Date(state.StartedAtMs),
        EndTime: new Date(nowMs),
        // 公式与两端历史实现逐字一致，历史数据依赖这个两位小数的精度行为，不得改动
        DurationMinutes: Number(((nowMs - state.StartedAtMs - totalPausedMs) / 60_000).toFixed(2)),
    };
}

export function GetTimerElapsedSeconds(state: ITimerState, nowMs: number): number {
    if (state.StartedAtMs === null) {
        return 0;
    }

    const elapsedMs = nowMs - state.StartedAtMs - GetTotalPausedMs(state, nowMs);

    // 下限 0：系统时钟回跳时不能显示负秒数
    return Math.max(0, Math.floor(elapsedMs / 1000));
}

// 仍处于暂停中时，本次暂停还没累加进 AccumulatedPauseMs，必须现算补上，否则暂停中直接结束的记录时长会虚高
function GetTotalPausedMs(state: ITimerState, nowMs: number): number {
    if (state.PausedAtMs === null) {
        return state.AccumulatedPauseMs;
    }

    return state.AccumulatedPauseMs + (nowMs - state.PausedAtMs);
}
