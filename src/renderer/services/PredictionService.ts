import type { IRecord } from "@dickhelper/shared";

export type PredictionLevel = "low" | "medium" | "high" | "veryHigh";

export interface IPrediction {
    readonly Level: PredictionLevel;
    readonly DaysSinceLast: number;
    readonly AverageInterval: number;
    readonly NextEstimate: Date | null;
    readonly PeakHour?: number;
}

export class PredictionService {
    public static Analyze(records: IRecord[]): IPrediction {
        if (records.length === 0) {
            return PredictionService.EmptyPrediction();
        }

        const sorted = PredictionService.SortByEndTime(records);
        const daysSinceLast = PredictionService.CalcDaysSinceLast(sorted);
        const averageInterval = PredictionService.CalcAverageInterval(sorted);
        const peakHour = PredictionService.CalcPeakHour(sorted);
        const level = PredictionService.DetermineLevel(daysSinceLast, averageInterval);
        const nextEstimate = PredictionService.EstimateNext(sorted, averageInterval, peakHour);

        return {
            Level: level,
            DaysSinceLast: daysSinceLast,
            AverageInterval: averageInterval,
            NextEstimate: nextEstimate,
            PeakHour: peakHour,
        };
    }

    private static SortByEndTime(records: IRecord[]): IRecord[] {
        return [...records].sort((a, b) => a.EndTime.getTime() - b.EndTime.getTime());
    }

    private static CalcDaysSinceLast(sorted: IRecord[]): number {
        const now = new Date();
        const last = sorted[sorted.length - 1]!;
        const diffMs = now.getTime() - last.EndTime.getTime();
        return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    }

    private static CalcAverageInterval(sorted: IRecord[]): number {
        if (sorted.length < 2) {
            return 0;
        }

        const recent = sorted.slice(-30);
        let totalIntervalMs = 0;

        for (let index = 1; index < recent.length; index++) {
            const previous = recent[index - 1]!;
            const current = recent[index]!;
            totalIntervalMs += current.EndTime.getTime() - previous.EndTime.getTime();
        }

        const averageIntervalMs = totalIntervalMs / (recent.length - 1);
        return Math.max(0.1, averageIntervalMs / (1000 * 60 * 60 * 24));
    }

    private static CalcPeakHour(sorted: IRecord[]): number | undefined {
        if (sorted.length === 0) {
            return undefined;
        }

        const counts = new Array<number>(24).fill(0);
        for (const record of sorted) {
            const hour = record.EndTime.getHours();
            counts[hour] = (counts[hour] ?? 0) + 1;
        }

        let peakHour = 0;
        let peakCount = -1;

        for (let hour = 0; hour < counts.length; hour++) {
            const count = counts[hour] ?? 0;
            if (count > peakCount) {
                peakCount = count;
                peakHour = hour;
            }
        }

        return peakHour;
    }

    private static DetermineLevel(daysSinceLast: number, averageInterval: number): PredictionLevel {
        if (averageInterval <= 0) {
            return "low";
        }

        const ratio = daysSinceLast / averageInterval;

        if (ratio < 0.5) return "low";
        if (ratio < 0.9) return "medium";
        if (ratio < 1.3) return "high";
        return "veryHigh";
    }

    private static EstimateNext(sorted: IRecord[], averageInterval: number, peakHour: number | undefined): Date | null {
        if (sorted.length === 0 || averageInterval <= 0) {
            return null;
        }

        const last = sorted[sorted.length - 1]!;
        const estimate = new Date(last.EndTime.getTime() + averageInterval * 24 * 60 * 60 * 1000);

        if (peakHour !== undefined) {
            estimate.setHours(peakHour, 0, 0, 0);
        }

        const now = Date.now();
        while (estimate.getTime() <= now) {
            estimate.setDate(estimate.getDate() + 1);
        }

        return estimate;
    }

    private static EmptyPrediction(): IPrediction {
        return {
            Level: "low",
            DaysSinceLast: 0,
            AverageInterval: 0,
            NextEstimate: null,
        };
    }
}
