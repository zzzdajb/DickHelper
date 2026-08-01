import { useCallback, useEffect, useRef, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

// 固定 tag，避免与库默认 tag 或其他调用方混淆
const KEEP_AWAKE_TAG = "dickhelper-timer";

// 常亮只是锦上添花，激活失败不能阻断计时，因此吞掉异常
function ActivateKeepAwake(): void {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
        // 静默忽略
    });
}

function ReleaseKeepAwake(): void {
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {
        // 静默忽略
    });
}

export interface ITimerStopResult {
    readonly startTime: Date;
    readonly endTime: Date;
    readonly durationMinutes: number;
}

export interface IUseTimerResult {
    readonly isRecording: boolean;
    readonly isPaused: boolean;
    readonly elapsedSeconds: number;
    readonly start: () => void;
    readonly pause: () => void;
    readonly resume: () => void;
    readonly stop: () => ITimerStopResult | null;
}

export function useTimer(): IUseTimerResult {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const startTimeRef = useRef<Date | null>(null);
    const accumulatedPauseRef = useRef<number>(0);
    const lastPauseTimeRef = useRef<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const ClearTimer = useCallback((): void => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const UpdateElapsed = useCallback((): void => {
        if (startTimeRef.current === null) {
            return;
        }

        const now = new Date();
        const pausedMs =
            accumulatedPauseRef.current +
            (lastPauseTimeRef.current !== null ? now.getTime() - lastPauseTimeRef.current.getTime() : 0);
        const elapsedMs = now.getTime() - startTimeRef.current.getTime() - pausedMs;
        setElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
    }, []);

    const start = useCallback((): void => {
        ClearTimer();
        startTimeRef.current = new Date();
        accumulatedPauseRef.current = 0;
        lastPauseTimeRef.current = null;
        setIsRecording(true);
        setIsPaused(false);
        setElapsedSeconds(0);
        intervalRef.current = setInterval(UpdateElapsed, 1000);
        ActivateKeepAwake();
    }, [ClearTimer, UpdateElapsed]);

    const pause = useCallback((): void => {
        if (!isRecording || isPaused) {
            return;
        }

        setIsPaused(true);
        lastPauseTimeRef.current = new Date();
    }, [isPaused, isRecording]);

    const resume = useCallback((): void => {
        if (!isRecording || !isPaused) {
            return;
        }

        if (lastPauseTimeRef.current !== null) {
            accumulatedPauseRef.current += new Date().getTime() - lastPauseTimeRef.current.getTime();
            lastPauseTimeRef.current = null;
        }

        setIsPaused(false);
    }, [isPaused, isRecording]);

    const stop = useCallback((): ITimerStopResult | null => {
        ClearTimer();
        // 放在分支之前，正常结束与提前返回两条路径都会释放
        ReleaseKeepAwake();

        if (startTimeRef.current === null) {
            setIsRecording(false);
            setIsPaused(false);
            setElapsedSeconds(0);
            return null;
        }

        const endTime = new Date();
        const totalPausedMs =
            accumulatedPauseRef.current +
            (lastPauseTimeRef.current !== null ? endTime.getTime() - lastPauseTimeRef.current.getTime() : 0);
        const durationMinutes = Number(((endTime.getTime() - startTimeRef.current.getTime() - totalPausedMs) / 60_000).toFixed(2));
        const result: ITimerStopResult = {
            startTime: startTimeRef.current,
            endTime,
            durationMinutes,
        };

        setIsRecording(false);
        setIsPaused(false);
        setElapsedSeconds(0);
        startTimeRef.current = null;
        accumulatedPauseRef.current = 0;
        lastPauseTimeRef.current = null;

        return result;
    }, [ClearTimer]);

    useEffect(() => {
        return () => {
            ClearTimer();
            ReleaseKeepAwake();
        };
    }, [ClearTimer]);

    return {
        isRecording,
        isPaused,
        elapsedSeconds,
        start,
        pause,
        resume,
        stop,
    };
}
