import type { IRecord } from "@dickhelper/shared";

// 预测结果
export interface IPrediction {
    readonly Probability: number;        // 今日总概率 0-100
    readonly PeakHour: number;           // 最高概率时段 0-23
    readonly PeakProbability: number;    // 峰值概率 0-100
    readonly HourlyCurve: number[];      // 24 小时概率曲线 [0-100] x 24
    readonly WeeklyCurve: number[];      // 星期几概率 [0-100] x 7 (周一=0)
    readonly DaysSinceLast: number;      // 距上次天数
    readonly AverageInterval: number;    // 平均间隔天数
    readonly NextEstimate: Date | null;  // 预计下次时间
    readonly Streak: number;             // 当前连续天数（有记录）
}

export class PredictionService {
    public static Analyze(records: IRecord[]): IPrediction {
        if (records.length === 0) {
            return PredictionService.EmptyPrediction();
        }

        const sorted = [...records].sort(
            (a, b) => a.EndTime.getTime() - b.EndTime.getTime()
        );

        const hourlyCurve = PredictionService.CalcHourlyCurve(sorted);
        const weeklyCurve = PredictionService.CalcWeeklyCurve(sorted);
        const { averageInterval, daysSinceLast } = PredictionService.CalcIntervals(sorted);
        const streak = PredictionService.CalcStreak(sorted);

        const intervalFactor = PredictionService.IntervalProbability(daysSinceLast, averageInterval);
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = (now.getDay() + 6) % 7; // 周一=0

        const hourFactor = hourlyCurve[currentHour]! / Math.max(hourlyCurve.reduce((a, b) => Math.max(a, b), 0), 1);
        const dayFactor = weeklyCurve[currentDay]! / Math.max(weeklyCurve.reduce((a, b) => Math.max(a, b), 0), 1);

        const probability = Math.min(100, Math.round(
            intervalFactor * 0.5 + (hourFactor * 100) * 0.25 + (dayFactor * 100) * 0.25
        ));

        const peakHour = hourlyCurve.indexOf(hourlyCurve.reduce((a, b) => Math.max(a, b), 0));
        const peakProbability = hourlyCurve[peakHour]!;

        const nextEstimate = PredictionService.EstimateNext(sorted, averageInterval, peakHour);

        return {
            Probability: probability,
            PeakHour: peakHour,
            PeakProbability: peakProbability,
            HourlyCurve: hourlyCurve,
            WeeklyCurve: weeklyCurve,
            DaysSinceLast: daysSinceLast,
            AverageInterval: averageInterval,
            NextEstimate: nextEstimate,
            Streak: streak,
        };
    }

    private static CalcHourlyCurve(records: IRecord[]): number[] {
        const counts = new Array<number>(24).fill(0);
        for (const r of records) {
            counts[r.EndTime.getHours()]!++;
        }
        const max = Math.max(counts.reduce((a, b) => Math.max(a, b), 0), 1);
        return counts.map((c) => Math.round((c / max) * 100));
    }

    private static CalcWeeklyCurve(records: IRecord[]): number[] {
        const counts = new Array<number>(7).fill(0);
        for (const r of records) {
            const day = (r.EndTime.getDay() + 6) % 7; // 周一=0
            counts[day]!++;
        }
        const max = Math.max(counts.reduce((a, b) => Math.max(a, b), 0), 1);
        return counts.map((c) => Math.round((c / max) * 100));
    }

    private static CalcIntervals(sorted: IRecord[]): {
        averageInterval: number;
        daysSinceLast: number;
    } {
        const now = new Date();
        const last = sorted[sorted.length - 1]!;
        const daysSinceLast = (now.getTime() - last.EndTime.getTime()) / (1000 * 60 * 60 * 24);

        if (sorted.length < 2) {
            return { averageInterval: 1, daysSinceLast: Math.max(0, daysSinceLast) };
        }

        // 用最近 30 条记录算间隔更有代表性
        const recent = sorted.slice(-30);
        let totalInterval = 0;
        for (let i = 1; i < recent.length; i++) {
            totalInterval += (recent[i]!.EndTime.getTime() - recent[i - 1]!.EndTime.getTime());
        }
        const avgMs = totalInterval / (recent.length - 1);
        const averageInterval = Math.max(0.1, avgMs / (1000 * 60 * 60 * 24));

        return { averageInterval, daysSinceLast: Math.max(0, daysSinceLast) };
    }

    private static IntervalProbability(daysSince: number, avgInterval: number): number {
        // 距上次越久，概率越高，超过平均间隔后趋近 100
        const ratio = daysSince / avgInterval;
        // sigmoid 变换，ratio=1 时约 73%，ratio=2 时约 95%
        const p = 100 / (1 + Math.exp(-2.5 * (ratio - 0.8)));
        return Math.min(100, Math.round(p));
    }

    private static CalcStreak(sorted: IRecord[]): number {
        if (sorted.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streak = 0;
        let checkDate = new Date(today);

        // 如果今天没有记录，从昨天开始算
        const lastRecord = sorted[sorted.length - 1]!;
        const lastDate = new Date(lastRecord.EndTime);
        lastDate.setHours(0, 0, 0, 0);
        if (lastDate.getTime() < today.getTime()) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        for (let i = sorted.length - 1; i >= 0; i--) {
            const recordDate = new Date(sorted[i]!.EndTime);
            recordDate.setHours(0, 0, 0, 0);

            if (recordDate.getTime() === checkDate.getTime()) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
                // 跳过同一天的多条记录
                while (i > 0) {
                    const prev = new Date(sorted[i - 1]!.EndTime);
                    prev.setHours(0, 0, 0, 0);
                    if (prev.getTime() === recordDate.getTime()) {
                        i--;
                    } else {
                        break;
                    }
                }
            } else if (recordDate.getTime() < checkDate.getTime()) {
                break;
            }
        }
        return streak;
    }

    private static EstimateNext(
        sorted: IRecord[],
        avgInterval: number,
        peakHour: number
    ): Date | null {
        if (sorted.length === 0) return null;

        const last = sorted[sorted.length - 1]!;
        const estimate = new Date(last.EndTime.getTime() + avgInterval * 24 * 60 * 60 * 1000);
        estimate.setHours(peakHour, 0, 0, 0);

        // 如果预测时间已过，推到明天同一时段
        if (estimate.getTime() < Date.now()) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(peakHour, 0, 0, 0);
            return tomorrow;
        }
        return estimate;
    }

    private static EmptyPrediction(): IPrediction {
        return {
            Probability: 0,
            PeakHour: 0,
            PeakProbability: 0,
            HourlyCurve: new Array<number>(24).fill(0),
            WeeklyCurve: new Array<number>(7).fill(0),
            DaysSinceLast: 0,
            AverageInterval: 0,
            NextEstimate: null,
            Streak: 0,
        };
    }
}
