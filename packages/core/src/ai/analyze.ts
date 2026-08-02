import type { IAiAnalysisData, IAiConfig } from "./ai.types";
import { AnalyzeLocally, NO_DATA_MESSAGE } from "./analyzeLocally";
import { AnalyzeWithApi } from "./analyzeWithApi";

export async function Analyze(data: IAiAnalysisData, config: IAiConfig): Promise<string> {
    // 没有记录时无从分析，也不该为此花一次网络请求
    if (data.TotalCount === 0) {
        return NO_DATA_MESSAGE;
    }

    if (config.Provider === "local") {
        return AnalyzeLocally(data);
    }

    return AnalyzeWithApi(data, config);
}
