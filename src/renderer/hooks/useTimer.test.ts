// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "./useTimer";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始状态：未录制、未暂停、0 秒", () => {
    const { result } = renderHook(() => useTimer());

    expect(result.current.IsRecording).toBe(false);
    expect(result.current.IsPaused).toBe(false);
    expect(result.current.ElapsedSeconds).toBe(0);
  });

  it("Start 后进入录制状态", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());

    expect(result.current.IsRecording).toBe(true);
    expect(result.current.IsPaused).toBe(false);
  });

  it("计时器每秒递增", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(3000));

    expect(result.current.ElapsedSeconds).toBe(3);
  });

  it("Pause 暂停计时，时间停止增长", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.Pause());

    expect(result.current.IsPaused).toBe(true);
    const pausedAt = result.current.ElapsedSeconds;

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.ElapsedSeconds).toBe(pausedAt);
  });

  it("Resume 继续计时，跳过暂停时间", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.Pause());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.Resume());

    expect(result.current.IsPaused).toBe(false);

    act(() => vi.advanceTimersByTime(2000));
    // 2s + 2s = 4s（暂停的3s不计入）
    expect(result.current.ElapsedSeconds).toBe(4);
  });

  it("Stop 返回 startTime、endTime 和 durationMinutes", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(60000));

    let stopResult: ReturnType<typeof result.current.Stop> = null;
    act(() => {
      stopResult = result.current.Stop();
    });

    expect(stopResult).not.toBeNull();
    expect(stopResult!.startTime).toBeInstanceOf(Date);
    expect(stopResult!.endTime).toBeInstanceOf(Date);
    expect(stopResult!.durationMinutes).toBeCloseTo(1, 1);
  });

  it("Stop 后状态重置", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => { result.current.Stop(); });

    expect(result.current.IsRecording).toBe(false);
    expect(result.current.IsPaused).toBe(false);
    expect(result.current.ElapsedSeconds).toBe(0);
  });

  it("未开始时 Stop 返回 null", () => {
    const { result } = renderHook(() => useTimer());

    let stopResult: ReturnType<typeof result.current.Stop> = null;
    act(() => {
      stopResult = result.current.Stop();
    });

    expect(stopResult).toBeNull();
  });

  it("未录制时 Pause 无效", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Pause());
    expect(result.current.IsPaused).toBe(false);
  });

  it("未暂停时 Resume 无效", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => result.current.Resume());
    expect(result.current.IsPaused).toBe(false);
  });

  it("Stop 时暂停中，暂停时间正确扣除", () => {
    const { result } = renderHook(() => useTimer());

    act(() => result.current.Start());
    act(() => vi.advanceTimersByTime(10000));
    act(() => result.current.Pause());
    act(() => vi.advanceTimersByTime(5000));

    let stopResult: ReturnType<typeof result.current.Stop> = null;
    act(() => {
      stopResult = result.current.Stop();
    });

    // 10s 活跃 + 5s 暂停 = 10s 有效，约 0.17 分钟
    expect(stopResult!.durationMinutes).toBeCloseTo(10 / 60, 1);
  });
});
