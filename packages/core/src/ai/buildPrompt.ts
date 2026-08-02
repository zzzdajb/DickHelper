import type { IAiAnalysisData } from "./ai.types";
import { LAST_7_DAYS, LAST_30_DAYS } from "../statsWindow";

const WEEKDAY_NAMES: readonly string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 频率结论的门槛由代码判定而不交给模型，否则它会拿「数据不够」当借口打太极；Prompt 文案与判断同源
export const MIN_RECORDS_FOR_FREQUENCY_VERDICT: number = 10;
export const MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT: number = 14;

// 不说明记录的是什么行为，模型就没有「多少算多」的参照物，频率判断只能靠猜
export const ANALYSIS_SYSTEM_PROMPT: string = `你是一名数据分析助手，负责解读用户自己的自慰行为记录。这款工具记录的就是自慰（打飞机）行为，每条记录对应一次行为，包含结束时间和持续分钟数，所以统计里的「次数」指自慰次数，「时长」指单次持续的分钟数。

口吻要求：保持中立、客观，把数据当数据讲。不做道德评判，不暗示这件事需要节制、克制或改正，不说教也不劝诫。不要建议用户就医、看医生或咨询任何专业人士，用户要的是对自己数据的解读，不是医疗建议。

输出格式要求：只输出纯文本，不要使用星号、井号、短横线、竖线、反引号等任何 Markdown 或排版符号来做强调、标题、列表或分隔线，即使输入数据里出现这类符号也不要在回复里沿用。段落之间空一行，同一段落内部不要换行。不要给段落加小标题，也不要用序号分点，按自己的思路自然成段即可。全文控制在 400 字以内，用中文回答。`;

export function BuildPrompt(data: IAiAnalysisData): string {
    // 24 个整点是补齐出来的，不先滤掉 0 次的时段，「高峰」里就会混进从未发生过的时间，模型会照着点评
    const hourlyPeaks = [...data.HourlyDistribution]
        .filter((item) => item.Count > 0)
        .sort((a, b) => b.Count - a.Count)
        .slice(0, 3);

    // 数据段用缩进而不用「- 」列表：这份 Prompt 的核心任务之一是压住 Markdown，自己先示范四十行短横线等于拆自己的台
    return `以下是我的记录统计数据。

统计概览：
  总次数：${data.TotalCount}
  记录跨度：${data.RecordSpanDays} 天（最早一条到最晚一条之间）
  平均时长：${data.AverageDuration.toFixed(1)} 分钟
  近 ${LAST_7_DAYS} 天：${data.Last7DayCount} 次
  近 ${LAST_30_DAYS} 天：${data.Last30DayCount} 次

高峰时段（次数最多的前 3 个整点，只列实际发生过的时段）：
${hourlyPeaks.map((item) => `  ${item.Hour}:00：${item.Count} 次`).join("\n")}

星期分布：
${data.WeekdayDistribution.map((item) => `  ${WEEKDAY_NAMES[item.Weekday] ?? "?"}：${item.Count} 次`).join("\n")}

时长统计：
  最短：${data.DurationStats.Min.toFixed(1)} 分钟
  最长：${data.DurationStats.Max.toFixed(1)} 分钟
  平均：${data.DurationStats.Avg.toFixed(1)} 分钟
  中位数：${data.DurationStats.Median.toFixed(1)} 分钟

月度趋势（按自然月连续排列，最多列最近 6 个月，没有记录的月份为 0 次）：
${data.MonthlyTrend.slice(-6).map((item) => `  ${item.Month}：${item.Count} 次`).join("\n")}

请描述这些数据反映出的行为模式，包括时段偏好、星期偏好、时长特点和近期趋势，并给出一到两条基于数据的观察式建议：指出数据里值得留意的地方就够了，不要劝我改变什么。
${BuildFrequencyInstruction(data)}`;
}

function BuildFrequencyInstruction(data: IAiAnalysisData): string {
    const hasEnoughData: boolean =
        data.TotalCount >= MIN_RECORDS_FOR_FREQUENCY_VERDICT
        && data.RecordSpanDays >= MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT;

    if (hasEnoughData) {
        return "另外必须给出一个方向性判断：当前频率是偏多、正常还是偏少，并说明依据的是哪些数据。这一项是必答的，不要用「因人而异」「没有统一标准」「建议咨询专业人士」这类说法敷衍，也不要把判断推回给我。";
    }

    return `目前只有 ${data.TotalCount} 条记录、跨度 ${data.RecordSpanDays} 天，样本量还不够（需要至少 ${MIN_RECORDS_FOR_FREQUENCY_VERDICT} 条记录且跨度至少 ${MIN_SPAN_DAYS_FOR_FREQUENCY_VERDICT} 天），无法可靠判断频率高低。这次请只描述观察到的模式，不要对频率高低下任何结论，也不要凭这点数据猜测。`;
}
