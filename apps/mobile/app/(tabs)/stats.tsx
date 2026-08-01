import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Surface, Text } from "react-native-paper";
import type { IRecord } from "@dickhelper/shared";
import { BuildAnalysisData, Analyze, CountInWindow, LAST_7_DAYS, LAST_30_DAYS } from "@dickhelper/core";
import type { IAiConfig } from "@dickhelper/core";
import { useAppTheme, type AppTheme } from "../../src/theme";
import { useRecords } from "../../src/hooks/useRecords";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";
import { FormatDurationMinutes, FormatDateTime } from "../../src/utils/formatters";

const AI_PROVIDER_KEY = "ai_provider";
const AI_API_ENDPOINT_KEY = "ai_api_endpoint";
const AI_API_KEY_KEY = "ai_api_key";
const AI_MODEL_KEY = "ai_model";

const DEFAULT_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function CalculateMetrics(records: IRecord[]): {
    readonly total: number;
    readonly averageDuration: number;
    readonly last7DayCount: number;
    readonly last30DayCount: number;
    readonly latestEndTime: Date | null;
} {
    const now = new Date();

    let totalDuration = 0;
    let latestEndTime: Date | null = null;

    for (const record of records) {
        totalDuration += record.Duration;
        if (latestEndTime === null || record.EndTime > latestEndTime) {
            latestEndTime = record.EndTime;
        }
    }

    return {
        total: records.length,
        averageDuration: records.length > 0 ? totalDuration / records.length : 0,
        last7DayCount: CountInWindow(records, now, LAST_7_DAYS),
        last30DayCount: CountInWindow(records, now, LAST_30_DAYS),
        latestEndTime,
    };
}

export default function StatsScreen() {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);
    const database = useMobileDatabaseService();
    const { records, loading, error } = useRecords();
    const metrics = useMemo(() => CalculateMetrics(records), [records]);

    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

    const HandleAnalyze = useCallback(async (): Promise<void> => {
        setAiLoading(true);
        setAiError(null);

        try {
            const savedProvider = await database.GetSetting(AI_PROVIDER_KEY);
            const savedEndpoint = await database.GetSetting(AI_API_ENDPOINT_KEY);
            const savedKey = await database.GetSetting(AI_API_KEY_KEY);
            const savedModel = await database.GetSetting(AI_MODEL_KEY);

            const config: IAiConfig = {
                Provider: savedProvider === "openai" ? "openai" : "local",
                ApiEndpoint: savedEndpoint ?? DEFAULT_API_ENDPOINT,
                ApiKey: savedKey ?? "",
                Model: savedModel ?? DEFAULT_MODEL,
            };

            const analysisData = BuildAnalysisData(records);
            const result = await Analyze(analysisData, config);

            setAiResult(result);
            setHasAnalyzed(true);
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setAiError(errorMessage);
        } finally {
            setAiLoading(false);
        }
    }, [database, records]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    统计
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    追踪频率、时长与近期趋势
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
                    <View style={styles.grid}>
                        <MetricTile
                            title="总次数"
                            value={String(metrics.total)}
                            accentColor={theme.colors.primary}
                        />
                        <MetricTile
                            title="平均时长"
                            value={FormatDurationMinutes(metrics.averageDuration)}
                            accentColor={theme.colors.secondary}
                        />
                        <MetricTile
                            title={`近 ${LAST_7_DAYS} 天`}
                            value={String(metrics.last7DayCount)}
                            accentColor={theme.colors.tertiary}
                        />
                        <MetricTile
                            title={`近 ${LAST_30_DAYS} 天`}
                            value={String(metrics.last30DayCount)}
                            accentColor={theme.colors.error}
                        />
                    </View>

                    <Surface style={styles.noteSurface} elevation={0}>
                        <Text variant="labelMedium" style={styles.noteTitle}>
                            最近结束时间
                        </Text>
                        <Text variant="bodyMedium" style={styles.noteValue}>
                            {metrics.latestEndTime !== null ? FormatDateTime(metrics.latestEndTime) : "暂无记录"}
                        </Text>
                    </Surface>

                    <Surface style={styles.aiSurface} elevation={1}>
                        <Text variant="titleMedium" style={styles.aiTitle}>
                            AI 分析
                        </Text>
                        <Text variant="bodyMedium" style={styles.aiSubtitle}>
                            基于记录数据生成行为分析洞察
                        </Text>

                        <Button
                            mode="contained-tonal"
                            icon={hasAnalyzed ? "refresh" : "brain"}
                            onPress={() => {
                                void HandleAnalyze();
                            }}
                            loading={aiLoading}
                            disabled={aiLoading || records.length === 0}
                            style={styles.aiButton}
                        >
                            {hasAnalyzed ? "重新分析" : "开始分析"}
                        </Button>

                        {aiLoading ? (
                            <View style={styles.aiLoadingRow}>
                                <ActivityIndicator size="small" />
                                <Text variant="bodyMedium" style={styles.aiLoadingText}>
                                    正在分析中...
                                </Text>
                            </View>
                        ) : null}

                        {aiError !== null ? (
                            <Text variant="bodyMedium" style={styles.aiErrorText}>
                                {aiError}
                            </Text>
                        ) : null}

                        {aiResult !== null ? (
                            <Surface style={styles.aiResultSurface} elevation={0}>
                                {aiResult.split("\n\n").map((paragraph, index) => (
                                    <Text key={index} variant="bodyMedium" style={styles.aiResultText}>
                                        {paragraph}
                                    </Text>
                                ))}
                            </Surface>
                        ) : null}
                    </Surface>
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
            <Text variant="headlineSmall" style={[styles.metricValue, { color: props.accentColor }]}>
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
        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 12,
        },
        metricTile: {
            width: "48%",
            minHeight: 120,
            borderRadius: 12,
            padding: 16,
            backgroundColor: theme.colors.surface,
            justifyContent: "space-between",
        },
        metricTitle: {
            color: theme.colors.textMuted,
        },
        metricValue: {
            fontWeight: "700",
            marginTop: 8,
        },
        noteSurface: {
            borderRadius: 12,
            padding: 16,
            backgroundColor: theme.colors.surface,
            gap: 8,
        },
        noteTitle: {
            color: theme.colors.onSurfaceVariant,
        },
        noteValue: {
            color: theme.colors.onSurface,
        },
        aiSurface: {
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            padding: 16,
            gap: 12,
        },
        aiTitle: {
            color: theme.colors.onSurface,
            fontWeight: "700",
        },
        aiSubtitle: {
            color: theme.colors.onSurfaceVariant,
        },
        aiButton: {
            borderRadius: 12,
            alignSelf: "flex-start",
        },
        aiLoadingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        aiLoadingText: {
            color: theme.colors.textMuted,
        },
        aiErrorText: {
            color: theme.colors.error,
        },
        aiResultSurface: {
            borderRadius: 10,
            backgroundColor: theme.colors.background,
            padding: 12,
            gap: 8,
        },
        aiResultText: {
            color: theme.colors.onSurface,
            lineHeight: 22,
        },
    });
}
