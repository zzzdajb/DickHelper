// 社区匿名统计 HTTP 客户端

interface ICommunityStatsResponse {
    WeekId: string;
    MedianCount: number;
    MedianDuration: number;
    SampleSize: number;
}

interface ISubmitPayload {
    ContributorId: string;
    WeekId: string;
    Count: number;
    AvgDuration: number;
}

// ISO 8601 标准周：周一起始，第一周包含该年第一个周四
export function GetCurrentWeekId(): string {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo: number = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export class CommunityService {
    private readonly _apiEndpoint: string;
    private readonly _timeoutMs: number = 8000;

    public constructor(apiEndpoint: string) {
        this._apiEndpoint = apiEndpoint.replace(/\/+$/, "");
    }

    public async SubmitStats(
        contributorId: string,
        weekId: string,
        count: number,
        avgDuration: number
    ): Promise<boolean> {
        const payload: ISubmitPayload = {
            ContributorId: contributorId,
            WeekId: weekId,
            Count: count,
            AvgDuration: avgDuration,
        };

        try {
            const response: Response = await fetch(`${this._apiEndpoint}/api/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this._timeoutMs),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    public async GetCommunityStats(weekId: string): Promise<ICommunityStatsResponse | null> {
        try {
            const response: Response = await fetch(
                `${this._apiEndpoint}/api/community?weekId=${encodeURIComponent(weekId)}`,
                { signal: AbortSignal.timeout(this._timeoutMs) }
            );
            if (!response.ok) return null;
            const data: ICommunityStatsResponse = await response.json() as ICommunityStatsResponse;
            return data;
        } catch {
            return null;
        }
    }
}
