import { useEffect, useRef, useState } from "react";
import {
    GetTimerElapsedSeconds,
    IDLE_TIMER_STATE,
    IsTimerPaused,
    IsTimerRunning,
    PauseTimer,
    ResumeTimer,
    StartTimer,
    StopTimer,
    type ITimerSession,
    type ITimerState,
    type IUseTimerResult,
} from "@dickhelper/core";

// 记账逻辑（何时开始、暂停累计多久、本次多少分钟）与对外契约 IUseTimerResult 都在 @dickhelper/core，
// 契约已是单一来源，此处无需与移动端人工同步：少实现一个成员会直接 typecheck 报错。这里只做 React 状态与每秒刷新
export function useTimer(): IUseTimerResult {
    const [timerState, setTimerState] = useState<ITimerState>(IDLE_TIMER_STATE);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    // 每秒的定时回调闭包读不到最新的 timerState，所以镜像一份 ref 给它和各个操作函数读
    const timerStateRef = useRef<ITimerState>(IDLE_TIMER_STATE);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function ApplyTimerState(next: ITimerState): void {
        timerStateRef.current = next;
        setTimerState(next);
    }

    function ClearTimer(): void {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    // 结束与取消共用这条清理路径：StopTimer 只算结果不清状态，漏掉任一条都会留下残留秒数或定时器
    function ResetTimerState(): void {
        ClearTimer();
        ApplyTimerState(IDLE_TIMER_STATE);
        setElapsedSeconds(0);
    }

    function HandleTick(): void {
        setElapsedSeconds(GetTimerElapsedSeconds(timerStateRef.current, Date.now()));
    }

    function Start(): void {
        // 先清掉可能残留的定时器，否则重复调用 Start 会泄漏一个 interval
        ClearTimer();
        ApplyTimerState(StartTimer(Date.now()));
        setElapsedSeconds(0);
        intervalRef.current = setInterval(HandleTick, 1000);
    }

    // 非法状态下公共包原样返回同一个状态对象，React 会自动跳过重渲染，所以这里不需要额外判断
    function Pause(): void {
        ApplyTimerState(PauseTimer(timerStateRef.current, Date.now()));
    }

    function Resume(): void {
        ApplyTimerState(ResumeTimer(timerStateRef.current, Date.now()));
    }

    function Stop(): ITimerSession | null {
        const session = StopTimer(timerStateRef.current, Date.now());
        ResetTimerState();
        return session;
    }

    // 未在计时中调用是安全空操作：状态本来就是 IDLE_TIMER_STATE
    function Cancel(): void {
        ResetTimerState();
    }

    // 卸载时清理定时器。依赖数组必须为空、清理内联：填了依赖就会每次重渲染都跑一遍 cleanup，把正在计时的 interval 清掉
    useEffect(() => {
        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        IsRecording: IsTimerRunning(timerState),
        IsPaused: IsTimerPaused(timerState),
        ElapsedSeconds: elapsedSeconds,
        Start,
        Pause,
        Resume,
        Stop,
        Cancel,
    };
}
