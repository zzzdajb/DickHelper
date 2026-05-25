interface IAiAnalysisData {
    TotalCount: number;
    AverageDuration: number;
    FrequencyPerWeek: number;
    FrequencyPerMonth: number;
    HourlyDistribution: { Hour: number; Count: number }[];
    WeekdayDistribution: { Weekday: number; Count: number }[];
    MonthlyTrend: { Month: string; Count: number }[];
    DurationStats: { Min: number; Max: number; Avg: number; Median: number };
}

export interface IAiConfig {
    Provider: "openai" | "local";
    ApiEndpoint: string;
    ApiKey: string;
    Model: string;
}

const WEEKDAY_NAMES: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const FETCH_TIMEOUT_MS: number = 30_000;

const BuildPrompt = (data: IAiAnalysisData): string => {
    const hourlyPeaks = [...data.HourlyDistribution]
        .sort((a, b) => b.Count - a.Count)
        .slice(0, 3);

    return `你是一个健康数据分析助手。请基于以下统计数据，给出简洁的分析和建议（中文回答，尽量简明）：

统计概览：
- 总次数：${data.TotalCount}
- 平均时长：${data.AverageDuration.toFixed(1)} 分钟
- 本周频率：${data.FrequencyPerWeek} 次
- 本月频率：${data.FrequencyPerMonth} 次

高峰时段（前 3）：
${hourlyPeaks.map((item) => `- ${item.Hour}:00：${item.Count} 次`).join("\n")}

星期分布：
${data.WeekdayDistribution.map((item) => `- ${WEEKDAY_NAMES[item.Weekday] ?? "?"}：${item.Count} 次`).join("\n")}

时长统计：
- 最短：${data.DurationStats.Min.toFixed(1)} 分钟
- 最长：${data.DurationStats.Max.toFixed(1)} 分钟
- 平均：${data.DurationStats.Avg.toFixed(1)} 分钟
- 中位数：${data.DurationStats.Median.toFixed(1)} 分钟

月度趋势（最近 6 个月）：
${data.MonthlyTrend.slice(-6).map((item) => `- ${item.Month}：${item.Count} 次`).join("\n")}

请分析：1. 行为模式特点 2. 当前频率是否偏高 3. 简短建议`;
};

const FetchWithTimeout = (url: string, options: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
        clearTimeout(timer);
    });
};

const ExtractOpenAiText = (result: unknown): string => {
    const body = result as Record<string, unknown> | null;
    if (body === null || typeof body !== "object") {
        throw new Error(`API 返回格式异常: ${JSON.stringify(result)}`);
    }

    const choices = body.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error(`API 返回内容为空: ${JSON.stringify(result)}`);
    }

    const first = choices[0];
    if (first === undefined || typeof first !== "object") {
        throw new Error(`API 返回格式异常: ${JSON.stringify(result)}`);
    }

    const message = (first as Record<string, unknown>).message as Record<string, unknown> | undefined;
    if (message === undefined || typeof message.content !== "string") {
        throw new Error(`API 返回格式异常: ${JSON.stringify(result)}`);
    }

    return message.content;
};

const AnalyzeWithApi = async (data: IAiAnalysisData, config: IAiConfig): Promise<string> => {
    if (config.ApiEndpoint.trim() === "") {
        throw new Error("API 地址不能为空。");
    }
    if (config.Model.trim() === "") {
        throw new Error("OpenAI 兼容接口需要填写模型名称。");
    }

    let parsedEndpoint: URL;
    try {
        parsedEndpoint = new URL(config.ApiEndpoint);
    } catch {
        throw new Error(`API 地址无效: ${config.ApiEndpoint}`);
    }

    if (parsedEndpoint.protocol !== "https:" && parsedEndpoint.protocol !== "http:") {
        throw new Error(`API 地址仅支持 http/https 协议: ${config.ApiEndpoint}`);
    }

    const apiKey: string = config.ApiKey.trim();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (apiKey !== "") {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await FetchWithTimeout(config.ApiEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: config.Model,
            messages: [{ role: "user", content: BuildPrompt(data) }],
            max_tokens: 1024,
        }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`API 错误 ${response.status} ${response.statusText}: ${responseText}`);
    }

    let parsedResponse: unknown;
    try {
        parsedResponse = JSON.parse(responseText) as unknown;
    } catch {
        throw new Error(`API 返回不是有效 JSON: ${responseText}`);
    }

    return ExtractOpenAiText(parsedResponse);
};

const AnalyzeLocally = (data: IAiAnalysisData): string => {
    if (data.TotalCount === 0) {
        return "暂无数据记录，开始记录后即可获得分析洞察。";
    }

    const insights: string[] = [];

    const peakHours = [...data.HourlyDistribution]
        .filter((item) => item.Count > 0)
        .sort((a, b) => b.Count - a.Count);
    if (peakHours.length > 0) {
        const top = peakHours[0]!;
        const period = top.Hour < 6 ? "凌晨" : top.Hour < 12 ? "上午" : top.Hour < 18 ? "下午" : "晚上";
        insights.push(`高峰时段主要集中在${period} ${String(top.Hour).padStart(2, "0")}:00 附近，最高为 ${top.Count} 次。`);
    }

    let peakDay: { Weekday: number; Count: number } | undefined;
    for (const item of data.WeekdayDistribution) {
        if (peakDay === undefined || item.Count > peakDay.Count) {
            peakDay = item;
        }
    }
    if (peakDay !== undefined && peakDay.Count > 0) {
        insights.push(`星期分布最活跃的是${WEEKDAY_NAMES[peakDay.Weekday] ?? "?"}，共有 ${peakDay.Count} 次。`);
    }

    const weeklyCount = data.FrequencyPerWeek;
    if (weeklyCount <= 3) {
        insights.push(`本周频率约 ${weeklyCount} 次，整体偏平稳。`);
    } else if (weeklyCount <= 7) {
        insights.push(`本周频率约 ${weeklyCount} 次，处于中等水平。`);
    } else {
        insights.push(`本周频率约 ${weeklyCount} 次，频率偏高，建议适当控制。`);
    }

    insights.push(`持续时长范围约 ${data.DurationStats.Min.toFixed(1)} - ${data.DurationStats.Max.toFixed(1)} 分钟。`);
    insights.push(`平均时长 ${data.DurationStats.Avg.toFixed(1)} 分钟，中位数 ${data.DurationStats.Median.toFixed(1)} 分钟。`);

    const recentMonths = data.MonthlyTrend.slice(-2);
    if (recentMonths.length === 2) {
        const previous = recentMonths[0]!;
        const latest = recentMonths[1]!;
        if (latest.Count > previous.Count) {
            insights.push(`近期趋势上升：${latest.Month} 比 ${previous.Month} 增加了 ${latest.Count - previous.Count} 次。`);
        } else if (latest.Count < previous.Count) {
            insights.push(`近期趋势下降：${latest.Month} 比 ${previous.Month} 减少了 ${previous.Count - latest.Count} 次。`);
        } else {
            insights.push(`近期趋势稳定：${previous.Month} 和 ${latest.Month} 次数相同。`);
        }
    }

    return insights.join("\n\n");
};

export const Analyze = async (data: IAiAnalysisData, config: IAiConfig): Promise<string> => {
    if (config.Provider === "local") {
        return AnalyzeLocally(data);
    }

    return AnalyzeWithApi(data, config);
};
