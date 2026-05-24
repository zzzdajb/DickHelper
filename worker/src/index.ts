// 社区匿名聚合统计 Cloudflare Worker（D1 后端）

interface Env {
    DB: D1Database;
}

interface ISubmitPayload {
    ContributorId: string;
    WeekId: string;
    Count: number;
    AvgDuration: number;
}

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COUNT = 100;
const MAX_DURATION = 480;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        const url = new URL(request.url);

        if (url.pathname === "/api/submit" && request.method === "POST") {
            return HandleSubmit(request, env);
        }

        if (url.pathname === "/api/community" && request.method === "GET") {
            return HandleGetCommunity(url, env);
        }

        return JsonResponse({ error: "Not found" }, 404);
    },
};

async function HandleSubmit(request: Request, env: Env): Promise<Response> {
    let payload: ISubmitPayload;
    try {
        payload = await request.json() as ISubmitPayload;
    } catch {
        return JsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (
        typeof payload.ContributorId !== "string" || !UUID_REGEX.test(payload.ContributorId) ||
        typeof payload.WeekId !== "string" || !/^\d{4}-W\d{2}$/.test(payload.WeekId) ||
        typeof payload.Count !== "number" || !Number.isInteger(payload.Count) || payload.Count < 0 || payload.Count > MAX_COUNT ||
        typeof payload.AvgDuration !== "number" || payload.AvgDuration < 0 || payload.AvgDuration > MAX_DURATION
    ) {
        return JsonResponse({ error: "Invalid payload" }, 400);
    }

    // 防刷：同一 contributor 60 秒内只允许一次提交
    const lastUpdate = await env.DB.prepare(
        `SELECT updated_at FROM stats WHERE contributor_id = ? ORDER BY updated_at DESC LIMIT 1`
    ).bind(payload.ContributorId).first<{ updated_at: string }>();

    if (lastUpdate !== null) {
        const elapsed: number = Date.now() - new Date(lastUpdate.updated_at + "Z").getTime();
        if (elapsed < 60_000) {
            return JsonResponse({ error: "Rate limited, retry after 60s" }, 429);
        }
    }

    // 每个 contributorId + weekId 只保留一条，重复提交覆盖
    await env.DB.prepare(
        `INSERT OR REPLACE INTO stats (contributor_id, week_id, count, avg_duration, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(payload.ContributorId, payload.WeekId, payload.Count, payload.AvgDuration).run();

    // 惰性清理：删除 26 周（半年）前的数据
    await env.DB.prepare(
        `DELETE FROM stats WHERE week_id < ?`
    ).bind(WeekIdNWeeksAgo(26)).run();

    return JsonResponse({ ok: true });
}

async function HandleGetCommunity(url: URL, env: Env): Promise<Response> {
    const weekId: string | null = url.searchParams.get("weekId");
    if (weekId === null || !/^\d{4}-W\d{2}$/.test(weekId)) {
        return JsonResponse({ error: "Missing or invalid weekId" }, 400);
    }

    // 查询该周全部提交
    const { results } = await env.DB.prepare(
        `SELECT count, avg_duration FROM stats WHERE week_id = ?`
    ).bind(weekId).all<{ count: number; avg_duration: number }>();

    if (results.length === 0) {
        return JsonResponse({
            WeekId: weekId,
            MedianCount: 0,
            MedianDuration: 0,
            SampleSize: 0,
        });
    }

    // IQR 过滤 + 中位数
    const counts: number[] = results.map((r) => r.count);
    const durations: number[] = results.map((r) => r.avg_duration);
    const filteredCounts: number[] = FilterOutliers(counts);
    const filteredDurations: number[] = FilterOutliers(durations);
    const medianCount: number = Median(filteredCounts.length > 0 ? filteredCounts : counts);
    const medianDuration: number = Median(filteredDurations.length > 0 ? filteredDurations : durations);

    return JsonResponse({
        WeekId: weekId,
        MedianCount: Math.round(medianCount * 10) / 10,
        MedianDuration: Math.round(medianDuration * 10) / 10,
        SampleSize: results.length,
    });
}

function Median(values: number[]): number {
    if (values.length === 0) return 0;
    const arr: number[] = [...values].sort((a, b) => a - b);
    const mid: number = Math.floor(arr.length / 2);
    if (arr.length % 2 === 0) {
        return (arr[mid - 1]! + arr[mid]!) / 2;
    }
    return arr[mid]!;
}

function FilterOutliers(values: number[]): number[] {
    if (values.length < 4) return values;
    const sorted: number[] = [...values].sort((a, b) => a - b);
    const q1: number = Median(sorted.slice(0, Math.floor(sorted.length / 2)));
    const q3: number = Median(sorted.slice(Math.ceil(sorted.length / 2)));
    const iqr: number = q3 - q1;
    const lower: number = q1 - 1.5 * iqr;
    const upper: number = q3 + 1.5 * iqr;
    return sorted.filter((v) => v >= lower && v <= upper);
}

function WeekIdNWeeksAgo(n: number): string {
    const d = new Date(Date.now() - n * 7 * 86400_000);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo: number = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function JsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}
