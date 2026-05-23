import { useState, useRef, useCallback, useEffect } from "react";


/**
 * 计时器 Hook
 * 封装开始/暂停/继续/停止逻辑
 * 与旧版 RecordForm 计时器保持相同行为：
 * - 暂停时停止累计时间增长
 * - 继续时跳过暂停期间的时间
 * - 停止时返回总用时（扣除暂停时间）
 */
export function useTimer() {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    // 用于在渲染间保存可变值，不触发重新渲染
    const startTimeRef = useRef<Date | null>(null);
    const accumulatedPauseRef = useRef<number>(0);
    const lastPauseTimeRef = useRef<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 清理定时器
    const clearTimer = useCallback((): void => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // 更新已用时间
    const updateElapsed = useCallback((): void => {
        if (startTimeRef.current === null) return;
        const now = new Date();
        const totalPaused =
            accumulatedPauseRef.current +
            (lastPauseTimeRef.current !== null
                ? now.getTime() - lastPauseTimeRef.current.getTime()
                : 0);
        const elapsed = Math.floor(
            (now.getTime() - startTimeRef.current.getTime() - totalPaused) / 1000
        );
        setElapsedSeconds(elapsed);
    }, []);

    // 开始计时
    const Start = useCallback((): void => {
        startTimeRef.current = new Date();
        accumulatedPauseRef.current = 0;
        lastPauseTimeRef.current = null;
        setIsRecording(true);
        setIsPaused(false);
        setElapsedSeconds(0);

        // 每秒更新
        intervalRef.current = setInterval(updateElapsed, 1000);
    }, [updateElapsed]);

    // 暂停
    const Pause = useCallback((): void => {
        if (!isRecording || isPaused) return;
        setIsPaused(true);
        lastPauseTimeRef.current = new Date();
    }, [isRecording, isPaused]);

    // 继续
    const Resume = useCallback((): void => {
        if (!isRecording || !isPaused) return;
        if (lastPauseTimeRef.current !== null) {
            const now = new Date();
            accumulatedPauseRef.current += now.getTime() - lastPauseTimeRef.current.getTime();
            lastPauseTimeRef.current = null;
        }
        setIsPaused(false);
    }, [isRecording, isPaused]);

    // 停止计时，返回 { startTime, endTime, durationMinutes }
    const Stop = useCallback((): {
        startTime: Date;
        endTime: Date;
        durationMinutes: number;
    } | null => {
        clearTimer();
        if (startTimeRef.current === null) {
            setIsRecording(false);
            setIsPaused(false);
            return null;
        }

        const endTime = new Date();
        const actualStartTime: Date = startTimeRef.current;
        // 计算总暂停时间
        const totalPaused =
            accumulatedPauseRef.current +
            (lastPauseTimeRef.current !== null
                ? endTime.getTime() - lastPauseTimeRef.current.getTime()
                : 0);
        const durationMs = endTime.getTime() - actualStartTime.getTime() - totalPaused;
        const durationMinutes = Number(((durationMs / (1000 * 60))).toFixed(2));

        setIsRecording(false);
        setIsPaused(false);
        setElapsedSeconds(0);
        startTimeRef.current = null;
        accumulatedPauseRef.current = 0;
        lastPauseTimeRef.current = null;

        return {
            startTime: actualStartTime,
            endTime,
            durationMinutes,
        };
    }, [clearTimer]);

    // 组件卸载时清理定时器
    useEffect(() => {
        return () => {
            clearTimer();
        };
    }, [clearTimer]);

    return {
        IsRecording: isRecording,
        IsPaused: isPaused,
        ElapsedSeconds: elapsedSeconds,
        Start,
        Pause,
        Resume,
        Stop,
    };
}
