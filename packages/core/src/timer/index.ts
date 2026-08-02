export type { ITimerSession, ITimerState, IUseTimerResult } from "./timer.types";
export {
    IDLE_TIMER_STATE,
    StartTimer,
    PauseTimer,
    ResumeTimer,
    StopTimer,
    GetTimerElapsedSeconds,
    IsTimerRunning,
    IsTimerPaused,
} from "./timer";
