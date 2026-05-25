// AI 分析服务：支持 Anthropic / OpenAI / Google / Ollama / CLI / 本地规则六种 provider

import { spawn } from "node:child_process";

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

interface IAiConfig {
    Provider: "anthropic" | "openai" | "google" | "ollama" | "cli" | "local";
    ApiKey: string;
    OllamaUrl: string;
    OllamaModel: string;
    GoogleModel: string;
    CliCommand: string;
}

const WEEKDAY_NAMES: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const FETCH_TIMEOUT_MS: number = 30_000;

const BuildPrompt = (data: IAiAnalysisData): string => {
    const hourlyPeaks = [...data.HourlyDistribution]
        .sort((a, b) => b.Count - a.Count)
        .slice(0, 3);

    return `你是一个健康数据分析助手。请基于以下统计数据，给出简洁的分析和建议（中文回答，200字以内）：

统计概览：
- 总次数：${data.TotalCount}
- 平均时长：${data.AverageDuration.toFixed(1)} 分钟
- 本周频率：${data.FrequencyPerWeek} 次
- 本月频率：${data.FrequencyPerMonth} 次

高峰时段（前3）：
${hourlyPeaks.map((h) => `- ${h.Hour}:00：${h.Count} 次`).join("\n")}

星期分布：
${data.WeekdayDistribution.map((d) => `- ${WEEKDAY_NAMES[d.Weekday] ?? "?"}：${d.Count} 次`).join("\n")}

时长统计：
- 最短：${data.DurationStats.Min.toFixed(1)} 分钟
- 最长：${data.DurationStats.Max.toFixed(1)} 分钟
- 中位数：${data.DurationStats.Median.toFixed(1)} 分钟

月度趋势（最近数月）：
${data.MonthlyTrend.slice(-6).map((m) => `- ${m.Month}：${m.Count} 次`).join("\n")}

请分析：1. 行为模式特点 2. 频率是否健康 3. 简短建议`;
};

// 带超时的 fetch 封装
const FetchWithTimeout = (url: string, options: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// Ollama 仅允许连接本地地址
const ValidateOllamaUrl = (url: string): void => {
    const parsed = new URL(url);
    const allowedHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
    if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(`Ollama 地址仅允许本地连接（localhost/127.0.0.1），当前: ${parsed.hostname}`);
    }
};

// 从 API 响应中安全提取文本
const ExtractAnthropicText = (result: unknown): string => {
    const body = result as Record<string, unknown> | null;
    if (body === null || typeof body !== "object") throw new Error("Anthropic 返回格式异常");
    const content = body.content;
    if (!Array.isArray(content) || content.length === 0) throw new Error("Anthropic 返回内容为空");
    const first = content[0] as Record<string, unknown> | undefined;
    if (first === undefined || typeof first.text !== "string") throw new Error("Anthropic 返回格式异常");
    return first.text;
};

const ExtractOpenAiText = (result: unknown): string => {
    const body = result as Record<string, unknown> | null;
    if (body === null || typeof body !== "object") throw new Error("OpenAI 返回格式异常");
    const choices = body.choices;
    if (!Array.isArray(choices) || choices.length === 0) throw new Error("OpenAI 返回内容为空");
    const first = choices[0] as Record<string, unknown> | undefined;
    if (first === undefined || typeof first !== "object") throw new Error("OpenAI 返回格式异常");
    const message = (first as Record<string, unknown>).message as Record<string, unknown> | undefined;
    if (message === undefined || typeof message.content !== "string") throw new Error("OpenAI 返回格式异常");
    return message.content;
};

const ExtractOllamaText = (result: unknown): string => {
    const body = result as Record<string, unknown> | null;
    if (body === null || typeof body !== "object" || typeof body.response !== "string") {
        throw new Error("Ollama 返回格式异常");
    }
    return body.response;
};

const AnalyzeWithAnthropic = async (data: IAiAnalysisData, apiKey: string): Promise<string> => {
    const response = await FetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: BuildPrompt(data) }],
        }),
    });
    if (!response.ok) {
        throw new Error(`Anthropic API 错误: ${response.status}`);
    }
    return ExtractAnthropicText(await response.json());
};

const AnalyzeWithOpenAi = async (data: IAiAnalysisData, apiKey: string): Promise<string> => {
    const response = await FetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: BuildPrompt(data) }],
            max_tokens: 1024,
        }),
    });
    if (!response.ok) {
        throw new Error(`OpenAI API 错误: ${response.status}`);
    }
    return ExtractOpenAiText(await response.json());
};

const AnalyzeWithOllama = async (data: IAiAnalysisData, url: string, model: string): Promise<string> => {
    ValidateOllamaUrl(url);
    const response = await FetchWithTimeout(`${url}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            prompt: BuildPrompt(data),
            stream: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Ollama API 错误: ${response.status}`);
    }
    return ExtractOllamaText(await response.json());
};

const ExtractGoogleText = (result: unknown): string => {
    const body = result as Record<string, unknown> | null;
    if (body === null || typeof body !== "object") throw new Error("Google API 返回格式异常");
    const candidates = body.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("Google API 返回内容为空");
    const first = candidates[0] as Record<string, unknown> | undefined;
    if (first === undefined || typeof first !== "object") throw new Error("Google API 返回格式异常");
    const content = first.content as Record<string, unknown> | undefined;
    if (content === undefined || typeof content !== "object") throw new Error("Google API 返回格式异常");
    const parts = content.parts;
    if (!Array.isArray(parts) || parts.length === 0) throw new Error("Google API 返回内容为空");
    const part = parts[0] as Record<string, unknown> | undefined;
    if (part === undefined || typeof part.text !== "string") throw new Error("Google API 返回格式异常");
    return part.text;
};

const AnalyzeWithGoogle = async (data: IAiAnalysisData, apiKey: string, model: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await FetchWithTimeout(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: BuildPrompt(data) }] }],
        }),
    });
    if (!response.ok) {
        throw new Error(`Google API 错误: ${response.status}`);
    }
    return ExtractGoogleText(await response.json());
};

const CLI_TIMEOUT_MS: number = 120_000;

const MAX_CLI_OUTPUT_BYTES: number = 1_048_576;

const AnalyzeWithCli = async (data: IAiAnalysisData, command: string): Promise<string> => {
    if (command.trim() === "") {
        throw new Error("未配置 CLI 命令");
    }

    const prompt: string = BuildPrompt(data);

    return new Promise<string>((resolve, reject) => {
        const parts: string[] = command.split(/\s+/);
        const bin: string = parts[0]!;
        const args: string[] = parts.slice(1);

        const child = spawn(bin, args, {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: CLI_TIMEOUT_MS,
            shell: true,
        });

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let totalBytes: number = 0;
        let settled: boolean = false;

        const settle = (fn: () => void): void => {
            if (settled) return;
            settled = true;
            fn();
        };

        child.stdout.on("data", (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_CLI_OUTPUT_BYTES) {
                child.kill();
                settle(() => reject(new Error("CLI 输出超过 1MB 限制")));
                return;
            }
            stdout.push(chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

        child.on("error", (err: Error) => {
            settle(() => reject(new Error(`CLI 启动失败: ${err.message}`)));
        });

        child.on("close", (code: number | null) => {
            const out: string = Buffer.concat(stdout).toString("utf-8").trim();
            if (code !== 0) {
                const errMsg: string = Buffer.concat(stderr).toString("utf-8").trim();
                settle(() => reject(new Error(`CLI 退出码 ${code ?? "null"}: ${errMsg || out || "无输出"}`)));
                return;
            }
            if (out === "") {
                settle(() => reject(new Error("CLI 命令无输出")));
                return;
            }
            settle(() => resolve(out));
        });

        try {
            child.stdin.write(prompt);
            child.stdin.end();
        } catch {
            // 进程可能已退出，error/close 事件会处理
        }
    });
};

const AnalyzeLocally = (data: IAiAnalysisData): string => {
    if (data.TotalCount === 0) {
        return "暂无数据记录，开始记录后即可获得分析洞察。";
    }

    const insights: string[] = [];

    // 高峰时段
    const peakHours = [...data.HourlyDistribution]
        .filter((h) => h.Count > 0)
        .sort((a, b) => b.Count - a.Count);
    if (peakHours.length > 0) {
        const top = peakHours[0]!;
        const period = top.Hour < 6 ? "凌晨" : top.Hour < 12 ? "上午" : top.Hour < 18 ? "下午" : "晚上";
        insights.push(`📍 高峰时段集中在${period} ${top.Hour}:00 左右（${top.Count} 次）。`);
    }

    // 星期分布
    const peakDay = data.WeekdayDistribution.reduce(
        (max, d) => (d.Count > max.Count ? d : max),
        data.WeekdayDistribution[0]!
    );
    if (peakDay.Count > 0) {
        insights.push(`📅 ${WEEKDAY_NAMES[peakDay.Weekday] ?? "?"}是最活跃的一天（${peakDay.Count} 次）。`);
    }

    // 频率评估
    const weeklyAvg: number = data.FrequencyPerMonth / 4;
    if (weeklyAvg <= 3) {
        insights.push(`✅ 周均频率约 ${weeklyAvg.toFixed(1)} 次，频率适中。`);
    } else if (weeklyAvg <= 7) {
        insights.push(`⚠️ 周均频率约 ${weeklyAvg.toFixed(1)} 次，频率偏高，建议适当控制。`);
    } else {
        insights.push(`🔴 周均频率约 ${weeklyAvg.toFixed(1)} 次，频率较高，建议关注身体状况。`);
    }

    // 时长
    if (data.DurationStats.Avg > 0) {
        insights.push(`⏱️ 平均时长 ${data.DurationStats.Avg.toFixed(1)} 分钟，中位数 ${data.DurationStats.Median.toFixed(1)} 分钟。`);
    }

    // 趋势
    const recentMonths = data.MonthlyTrend.slice(-3);
    if (recentMonths.length >= 2) {
        const last = recentMonths[recentMonths.length - 1]!;
        const prev = recentMonths[recentMonths.length - 2]!;
        if (last.Count > prev.Count) {
            insights.push(`📈 近期趋势上升：本月（${last.Count} 次）比上月（${prev.Count} 次）增加。`);
        } else if (last.Count < prev.Count) {
            insights.push(`📉 近期趋势下降：本月（${last.Count} 次）比上月（${prev.Count} 次）减少。`);
        } else {
            insights.push(`➡️ 近期趋势稳定，最近两个月均为 ${last.Count} 次。`);
        }
    }

    return insights.join("\n\n");
};

export const Analyze = async (data: IAiAnalysisData, config: IAiConfig): Promise<string> => {
    switch (config.Provider) {
        case "anthropic":
            return AnalyzeWithAnthropic(data, config.ApiKey);
        case "openai":
            return AnalyzeWithOpenAi(data, config.ApiKey);
        case "google":
            return AnalyzeWithGoogle(data, config.ApiKey, config.GoogleModel);
        case "ollama":
            return AnalyzeWithOllama(data, config.OllamaUrl, config.OllamaModel);
        case "cli":
            return AnalyzeWithCli(data, config.CliCommand);
        case "local":
            return AnalyzeLocally(data);
    }
};
