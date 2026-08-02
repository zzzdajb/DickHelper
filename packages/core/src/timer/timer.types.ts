// isRecording / isPaused 一律从这三个字段派生，不单独存，避免两端各自维护一份布尔值而走岔
export interface ITimerState {
    readonly StartedAtMs: number | null;
    readonly AccumulatedPauseMs: number;
    readonly PausedAtMs: number | null;
}

export interface ITimerSession {
    readonly StartTime: Date;
    readonly EndTime: Date;
    readonly DurationMinutes: number;
}

// 两端 React 对接层共用的对外契约，任一端漏实现一个成员都会在 typecheck 阶段报错。
// 放这里而不是 packages/shared：shared 无任何依赖、core 依赖 shared，而本类型要用 ITimerSession，
// 挪去 shared 就会形成 shared ↔ core 的循环依赖。类型本身只有布尔、数字和函数签名，不含 React 依赖。
export interface IUseTimerResult {
    readonly IsRecording: boolean;
    readonly IsPaused: boolean;
    readonly ElapsedSeconds: number;
    readonly Start: () => void;
    readonly Pause: () => void;
    readonly Resume: () => void;
    readonly Stop: () => ITimerSession | null;
    readonly Cancel: () => void;
}
