import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { AnalyzePrediction } from "@dickhelper/core";
import { useAppTheme, type AppTheme } from "../../src/theme";
import { useRecords } from "../../src/hooks/useRecords";
import { FormatDateTime, FormatRelativeDays } from "../../src/utils/formatters";

type PredictionAnalysis = ReturnType<typeof AnalyzePrediction>;

function FormatDateRange(start: Date | null, end: Date | null): string {
    if (start === null || end === null) {
        return "--";
    }

    return `${FormatDateTime(start)} - ${FormatDateTime(end)}`;
}

function GetTimeBucketLabel(date: Date | null): string {
    if (date === null) {
        return "--";
    }

    const hour = date.getHours();

    if (hour < 6) {
        return "00:00-06:00";
    }

    if (hour < 12) {
        return "06:00-12:00";
    }

    if (hour < 18) {
        return "12:00-18:00";
    }

    return "18:00-24:00";
}

function GetStatusTitle(status: PredictionAnalysis["Status"]): string {
    switch (status) {
        case "window_predicted":
            return "精确窗口";
        case "coarse_range_only":
            return "粗略范围";
        case "unstable_pattern":
            return "模式不稳";
        case "insufficient_samples":
        default:
            return "样本不足";
    }
}

function GetStatusText(prediction: PredictionAnalysis): string {
    switch (prediction.Status) {
        case "window_predicted":
            return `已选 ${prediction.ChosenConfidenceLevel === null ? "--" : `${Math.round(prediction.ChosenConfidenceLevel * 100)}%`} 置信窗口，半宽约 ${prediction.HalfWidthDays === null ? "--" : FormatRelativeDays(prediction.HalfWidthDays)}。`;
        case "coarse_range_only":
            return "中心点能算出来，但窗口过宽，只能先保留粗范围。";
        case "unstable_pattern":
            return "近期波动较大，暂时只保留中心估计。";
        case "insufficient_samples":
        default:
            return "至少还需要 2 个相邻间隔，继续记录后再预测。";
    }
}

function GetRangeText(prediction: PredictionAnalysis): string {
    switch (prediction.Status) {
        case "window_predicted":
            return `窗口：${FormatDateRange(prediction.PredictedWindowStart, prediction.PredictedWindowEnd)}`;
        case "coarse_range_only":
            return `范围：${FormatDateRange(prediction.CoarseRangeStart, prediction.CoarseRangeEnd)}`;
        case "unstable_pattern":
            return `中心：${prediction.PredictedCenterAt !== null ? FormatDateTime(prediction.PredictedCenterAt) : "--"}`;
        case "insufficient_samples":
        default:
            return "样本不足，继续记录后再预测。";
    }
}

function GetBucketLabel(prediction: PredictionAnalysis): string {
    return prediction.Status === "insufficient_samples" ? "最近时段" : "中心时段";
}

function GetBucketValue(prediction: PredictionAnalysis): string {
    return prediction.Status === "insufficient_samples"
        ? GetTimeBucketLabel(prediction.LastRecordAt)
        : GetTimeBucketLabel(prediction.PredictedCenterAt);
}

function GetTileValue(value: number | null): string {
    if (value === null) {
        return "--";
    }

    return FormatRelativeDays(value);
}

export default function PredictionScreen() {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);
    const { records, loading, error } = useRecords();
    const prediction = useMemo(() => AnalyzePrediction(records), [records]);

    const statusColor = (() => {
        switch (prediction.Status) {
            case "window_predicted":
                return theme.colors.primary;
            case "coarse_range_only":
                return theme.colors.secondary;
            case "unstable_pattern":
                return theme.colors.error;
            case "insufficient_samples":
            default:
                return theme.colors.outline;
        }
    })();

    const sampleText = `共 ${prediction.SampleCount} 条记录，${prediction.IntervalSampleCount} 个相邻间隔。`;
    const rangeText = GetRangeText(prediction);
    const bucketLabel = GetBucketLabel(prediction);
    const bucketValue = GetBucketValue(prediction);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    预测
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    根据最近的相邻间隔推测下一次窗口
                </Text>
            </View>

            {loading ? (
                <Text variant="bodyMedium" style={styles.stateText}>
                    正在加载记录...
                </Text>
            ) : error !== null ? (
                <Text variant="bodyMedium" style={styles.stateText}>
                    {error}
                </Text>
            ) : (
                <>
                    <Surface style={[styles.heroSurface, { borderColor: theme.colors.outline }]} elevation={1}>
                        <Text variant="labelLarge" style={styles.heroLabel}>
                            当前判断
                        </Text>
                        <Text variant="headlineSmall" style={[styles.heroValue, { color: statusColor }]}>
                            {GetStatusTitle(prediction.Status)}
                        </Text>
                        <Text variant="bodyMedium" style={styles.heroText}>
                            {GetStatusText(prediction)}
                        </Text>
                        <Text variant="bodyMedium" style={styles.heroRange}>
                            {rangeText}
                        </Text>
                        <Text variant="bodySmall" style={styles.heroCaption}>
                            {sampleText}
                        </Text>
                        <Text variant="bodySmall" style={styles.heroCaption}>
                            {bucketLabel}：{bucketValue}
                        </Text>
                    </Surface>

                    <View style={styles.grid}>
                        <MetricTile
                            title="中心间隔"
                            value={GetTileValue(prediction.CenterIntervalDays)}
                            accentColor={theme.colors.secondary}
                        />
                        <MetricTile
                            title="距离上次"
                            value={prediction.DaysSinceLast !== null ? FormatRelativeDays(prediction.DaysSinceLast) : "--"}
                            accentColor={theme.colors.tertiary}
                        />
                        <MetricTile
                            title="最近一次"
                            value={prediction.LastRecordAt !== null ? FormatDateTime(prediction.LastRecordAt) : "暂无"}
                            accentColor={theme.colors.error}
                        />
                        <MetricTile
                            title="记录数"
                            value={String(prediction.SampleCount)}
                            accentColor={theme.colors.primary}
                        />
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function MetricTile(props: {
    readonly title: string;
    readonly value: string;
    readonly accentColor: string;
}) {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);

    return (
        <Surface style={styles.metricTile} elevation={1}>
            <Text variant="labelLarge" style={styles.metricTitle}>
                {props.title}
            </Text>
            <Text variant="bodyLarge" style={[styles.metricValue, { color: props.accentColor }]}>
                {props.value}
            </Text>
        </Surface>
    );
}

// 样式表吃进主题算出来，颜色才能跟随深浅色切换，同时仍集中在文件底部一处
function CreateStyles(theme: AppTheme) {
    return StyleSheet.create({
        scrollContent: {
            flexGrow: 1,
            padding: 16,
            gap: 16,
        },
        header: {
            gap: 8,
        },
        title: {
            color: theme.colors.primary,
            fontWeight: "700",
        },
        subtitle: {
            color: theme.colors.onSurfaceVariant,
        },
        stateText: {
            color: theme.colors.textMuted,
        },
        heroSurface: {
            borderRadius: 12,
            padding: 20,
            backgroundColor: theme.colors.surface,
            gap: 10,
            borderWidth: 1,
        },
        heroLabel: {
            color: theme.colors.textMuted,
        },
        heroValue: {
            fontWeight: "700",
        },
        heroText: {
            color: theme.colors.textBody,
            lineHeight: 22,
        },
        heroRange: {
            color: theme.colors.onSurface,
            fontWeight: "700",
            lineHeight: 22,
        },
        heroCaption: {
            color: theme.colors.textMuted,
        },
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 12,
        },
        metricTile: {
            width: "48%",
            minHeight: 112,
            borderRadius: 12,
            padding: 16,
            backgroundColor: theme.colors.surface,
            justifyContent: "space-between",
        },
        metricTitle: {
            color: theme.colors.textMuted,
        },
        metricValue: {
            marginTop: 8,
        },
    });
}
