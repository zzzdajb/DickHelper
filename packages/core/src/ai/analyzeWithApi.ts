import type { IAiAnalysisData, IAiConfig } from "./ai.types";
import { ANALYSIS_SYSTEM_PROMPT, BuildPrompt } from "./buildPrompt";

const FETCH_TIMEOUT_MS: number = 30_000;

export async function AnalyzeWithApi(data: IAiAnalysisData, config: IAiConfig): Promise<string> {
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
        // 刻意不传 max_tokens 与 temperature：推理型模型收到这两个字段会直接 400，且思考过程会吃掉长度额度让正文返回空，长度改由 system prompt 约束
        body: JSON.stringify({
            model: config.Model,
            messages: [
                { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
                { role: "user", content: BuildPrompt(data) },
            ],
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
}

function FetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
        clearTimeout(timer);
    });
}

function ExtractOpenAiText(result: unknown): string {
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
}
