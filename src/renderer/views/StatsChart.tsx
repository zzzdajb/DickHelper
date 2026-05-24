import { useState, useEffect, type ReactNode } from "react";
import {
    Paper, Title, SimpleGrid, Stack, Text, Group, Box,
    Tooltip, ThemeIcon, Progress, Badge, Button, Loader,
} from "@mantine/core";
import { IconChartBar, IconClock, IconDroplet, IconHistory, IconUsers, IconBrain } from "@tabler/icons-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as ChartTooltip, ResponsiveContainer,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar,
} from "recharts";
import { DatabaseService } from "../services/DatabaseService";
import type { IStats, IDailyCount, ICommunityStats, IHourlyCount, IWeekdayCount, IMonthlyCount } from "../types/IRecord";

const DAYS_IN_WEEK: number = 7;
const WEEKS_TO_SHOW: number = 4;
const WEEKDAYS: string[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_FULL: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const TREND_DAYS: number = 90;
const CHART_HEIGHT: number = 280;

// 时长分桶配置
const DURATION_BINS: { Label: string; Min: number; Max: number }[] = [
    { Label: "0-5", Min: 0, Max: 5 },
    { Label: "5-10", Min: 5, Max: 10 },
    { Label: "10-15", Min: 10, Max: 15 },
    { Label: "15-20", Min: 15, Max: 20 },
    { Label: "20-30", Min: 20, Max: 30 },
    { Label: "30+", Min: 30, Max: Infinity },
];

// 填充缺失日期，确保趋势图连续
const FillDailyGaps = (counts: IDailyCount[], days: number): { Date: string; Count: number }[] => {
    const map = new Map<string, number>();
    for (const c of counts) {
        map.set(c.Date, c.Count);
    }
    const result: { Date: string; Count: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        result.push({ Date: key, Count: map.get(key) ?? 0 });
    }
    return result;
};

// 将原始时长数组按分桶统计
const BuildDurationBins = (durations: number[]): { Label: string; Count: number }[] => {
    return DURATION_BINS.map((bin) => ({
        Label: bin.Label,
        Count: durations.filter((d) => d >= bin.Min && d < bin.Max).length,
    }));
};

export const StatsChart = () => {
    const [stats, setStats] = useState<IStats>({
        TotalCount: 0,
        AverageDuration: 0,
        WeeklyAverageDuration: 0,
        FrequencyPerWeek: 0,
        FrequencyPerMonth: 0,
    });
    const [dailyCounts, setDailyCounts] = useState<Map<string, number>>(new Map());
    const [communityStats, setCommunityStats] = useState<ICommunityStats | null>(null);
    const [optedIn, setOptedIn] = useState<boolean>(false);
    const [trendData, setTrendData] = useState<{ Date: string; Count: number }[]>([]);
    const [hourlyData, setHourlyData] = useState<IHourlyCount[]>([]);
    const [weekdayData, setWeekdayData] = useState<IWeekdayCount[]>([]);
    const [monthlyData, setMonthlyData] = useState<IMonthlyCount[]>([]);
    const [durationData, setDurationData] = useState<{ Label: string; Count: number }[]>([]);
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const LoadData = (): void => {
        const onError = (err: unknown): void => {
            console.error("[StatsChart] 数据加载失败:", err);
        };

        DatabaseService.GetStats().then(setStats).catch(onError);

        // 热力图数据（4 周）
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const heatmapStart = new Date(now);
        heatmapStart.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));
        heatmapStart.setHours(0, 0, 0, 0);

        DatabaseService.GetDailyCounts(heatmapStart, now).then((counts: IDailyCount[]) => {
            const map = new Map<string, number>();
            for (const item of counts) {
                map.set(item.Date, item.Count);
            }
            setDailyCounts(map);
        }).catch(onError);

        // 趋势图数据（90 天）
        const trendStart = new Date(now);
        trendStart.setDate(now.getDate() - (TREND_DAYS - 1));
        trendStart.setHours(0, 0, 0, 0);

        DatabaseService.GetDailyCounts(trendStart, now).then((counts: IDailyCount[]) => {
            setTrendData(FillDailyGaps(counts, TREND_DAYS));
        }).catch(onError);

        // 图表聚合数据
        DatabaseService.GetHourlyDistribution().then(setHourlyData).catch(onError);
        DatabaseService.GetWeekdayDistribution().then(setWeekdayData).catch(onError);
        DatabaseService.GetMonthlyTrend().then(setMonthlyData).catch(onError);
        DatabaseService.GetDurationDistribution().then((durations: number[]) => {
            setDurationData(BuildDurationBins(durations));
        }).catch(onError);
    };

    const LoadCommunityData = (): void => {
        DatabaseService.GetConfig().then((config) => {
            setOptedIn(config.CommunityOptIn);
            if (config.CommunityOptIn) {
                DatabaseService.SubmitCommunityStats().then(() => {
                    DatabaseService.GetCommunityStats().then(setCommunityStats);
                });
            }
        });
    };

    useEffect(() => {
        LoadData();
        LoadCommunityData();

        const unsubscribe = DatabaseService.OnRecordsUpdated(() => {
            LoadData();
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const HandleAiAnalysis = async (): Promise<void> => {
        setAiLoading(true);
        setAiError(null);
        try {
            const result = await DatabaseService.RequestAiAnalysis();
            setAiResult(result);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "分析失败";
            setAiError(message);
        } finally {
            setAiLoading(false);
        }
    };

    // --- 热力图逻辑（保留原有实现） ---

    const GetContributionLevel = (count: number): number => {
        if (count === 0) return 0;
        if (count === 1) return 1;
        if (count === 2) return 2;
        if (count === 3) return 3;
        return 4;
    };

    const GenerateHeatmapData = (): { date: Date; count: number }[][] => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));

        const data: { date: Date; count: number }[][] = [];
        for (let week = 0; week < WEEKS_TO_SHOW; week++) {
            const weekData: { date: Date; count: number }[] = [];
            for (let day = 0; day < DAYS_IN_WEEK; day++) {
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + week * DAYS_IN_WEEK + day);
                const y = cellDate.getFullYear();
                const m = String(cellDate.getMonth() + 1).padStart(2, "0");
                const d = String(cellDate.getDate()).padStart(2, "0");
                const dateKey = `${y}-${m}-${d}`;
                weekData.push({
                    date: cellDate,
                    count: dailyCounts.get(dateKey) ?? 0,
                });
            }
            data.push(weekData);
        }
        return data;
    };

    const ContributionColor = (level: number): string => {
        const colors: string[] = [
            "rgba(235, 237, 240, 0.5)",
            "rgba(155, 233, 168, 0.5)",
            "rgba(64, 196, 99, 0.6)",
            "rgba(48, 161, 78, 0.8)",
            "rgba(33, 110, 57, 0.9)",
        ];
        return colors[level]!;
    };

    const GetMonthLabels = (): { label: string; weekIndex: number }[] => {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));
        const labels: { label: string; weekIndex: number }[] = [];

        for (let week = 0; week < WEEKS_TO_SHOW; week++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + week * 7);
            const monthName = date.getMonth() + 1;
            if (week === 0 || date.getDate() <= 7) {
                labels.push({ label: `${monthName}月`, weekIndex: week });
            }
        }
        return labels;
    };

    const heatmapData = GenerateHeatmapData();
    const monthLabels = GetMonthLabels();
    const hasRecords: boolean = stats.TotalCount > 0;

    // 雷达图数据：只在有数据时格式化
    const radarData = hourlyData.map((h) => ({
        Hour: `${h.Hour}时`,
        Count: h.Count,
    }));

    // 星期柱状图数据
    const weekdayChartData = weekdayData.map((d, i) => ({
        Day: WEEKDAY_FULL[i]!,
        Count: d.Count,
    }));

    // 月度趋势：简化月份标签
    const monthlyChartData = monthlyData.map((m) => ({
        Month: m.Month.slice(5),
        Count: m.Count,
    }));

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    数据仪表盘
                </Title>
                <Text size="sm" c="dimmed">
                    综合统计、趋势分析和 AI 洞察。
                </Text>
            </Stack>

            {/* 统计卡片 */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                <StatCard
                    title="总次数"
                    value={stats.TotalCount}
                    description="全部已保存记录"
                    icon={<IconHistory size={18} />}
                    color="blue"
                />
                <StatCard
                    title="平均时长"
                    value={`${stats.AverageDuration.toFixed(1)} 分钟`}
                    description="按全部记录计算"
                    icon={<IconClock size={18} />}
                    color="cyan"
                />
                <StatCard
                    title="本周次数"
                    value={stats.FrequencyPerWeek}
                    description="最近 7 天"
                    icon={<IconChartBar size={18} />}
                    color="green"
                />
                <StatCard
                    title="本月次数"
                    value={stats.FrequencyPerMonth}
                    description="最近 30 天"
                    icon={<IconDroplet size={18} />}
                    color="violet"
                />
            </SimpleGrid>

            {/* 发射日历热力图 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap={2}>
                        <Title order={4}>发射日历</Title>
                        <Text size="sm" c="dimmed">
                            颜色越深，代表当天记录次数越多。
                        </Text>
                    </Stack>
                    {!hasRecords && (
                        <Text size="sm" c="dimmed">暂无可统计数据</Text>
                    )}
                </Group>

                <Group gap="xs" wrap="nowrap" align="flex-start" justify="center">
                    <Stack gap={0} pt={24}>
                        {monthLabels.map((label, i) => (
                            <Text key={i} size="xs" c="dimmed" lh={1.2}>
                                {label.label}
                            </Text>
                        ))}
                    </Stack>

                    <Stack gap={0}>
                        <Group gap={2} mb={4}>
                            {WEEKDAYS.map((day, i) => (
                                <Text key={i} size="xs" c="dimmed" ta="center" w={18}>
                                    {day}
                                </Text>
                            ))}
                        </Group>

                        <Stack gap={4}>
                            {heatmapData.map((week, weekIndex) => (
                                <Group key={weekIndex} gap={4}>
                                    {week.map((cell, dayIndex) => {
                                        const level = GetContributionLevel(cell.count);
                                        return (
                                            <Tooltip
                                                key={dayIndex}
                                                label={`${cell.date.getFullYear()}年${cell.date.getMonth() + 1}月${cell.date.getDate()}日: ${cell.count}次`}
                                                withArrow
                                            >
                                                <Box
                                                    w={18}
                                                    h={18}
                                                    style={{
                                                        backgroundColor: ContributionColor(level),
                                                        borderRadius: 3,
                                                        cursor: "pointer",
                                                    }}
                                                />
                                            </Tooltip>
                                        );
                                    })}
                                </Group>
                            ))}
                        </Stack>
                    </Stack>
                </Group>
            </Paper>
            {optedIn && communityStats !== null && communityStats.SampleSize > 0 && (
                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Group justify="space-between" align="flex-start" mb="md">
                        <Stack gap={2}>
                            <Group gap="xs">
                                <IconUsers size={20} color="var(--mantine-color-grape-6)" />
                                <Title order={4}>社区对比</Title>
                            </Group>
                            <Text size="sm" c="dimmed">
                                你和社区匿名用户的本周对比（基于 {communityStats.SampleSize} 位用户）
                            </Text>
                        </Stack>
                        <Badge variant="light" color="grape" size="sm">匿名聚合</Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <ComparisonCard
                            label="本周次数"
                            myValue={stats.FrequencyPerWeek}
                            communityValue={communityStats.MedianCount}
                            unit="次"
                            color="green"
                        />
                        <ComparisonCard
                            label="本周平均时长"
                            myValue={stats.WeeklyAverageDuration}
                            communityValue={communityStats.MedianDuration}
                            unit="分钟"
                            color="cyan"
                            decimals={1}
                        />
                    </SimpleGrid>
                </Paper>
            )}

            {optedIn && communityStats === null && (
                <Paper shadow="sm" radius="md" p="md" withBorder>
                    <Group gap="xs">
                        <IconUsers size={18} color="var(--mantine-color-dimmed)" />
                        <Text size="sm" c="dimmed">社区数据加载中，或暂无足够样本...</Text>
                    </Group>
                </Paper>
            )}

            {/* 每日趋势折线图 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>每日趋势</Title>
                    <Text size="sm" c="dimmed">最近 {TREND_DAYS} 天的频率变化</Text>
                </Stack>
                <Box h={CHART_HEIGHT}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#228be6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#228be6" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis
                                dataKey="Date"
                                tick={{ fontSize: 11, fill: "#868e96" }}
                                tickFormatter={(v) => String(v).slice(5)}
                                interval={13}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "#868e96" }}
                                allowDecimals={false}
                            />
                            <ChartTooltip
                                formatter={(value) => [`${value} 次`, "次数"]}
                                labelFormatter={(label) => `日期: ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="Count"
                                stroke="#228be6"
                                strokeWidth={2}
                                fill="url(#trendGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Box>
            </Paper>

            {/* 月度趋势柱状图 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>月度对比</Title>
                    <Text size="sm" c="dimmed">最近 12 个月的频率对比</Text>
                </Stack>
                <Box h={CHART_HEIGHT}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis
                                dataKey="Month"
                                tick={{ fontSize: 11, fill: "#868e96" }}
                                tickFormatter={(v) => `${v}月`}
                            />
                            <YAxis tick={{ fontSize: 11, fill: "#868e96" }} allowDecimals={false} />
                            <ChartTooltip
                                formatter={(value) => [`${value} 次`, "次数"]}
                                labelFormatter={(label) => `${label}月`}
                            />
                            <Bar dataKey="Count" fill="#7950f2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Paper>

            {/* 双列图表：时段雷达 + 星期分布 */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Stack gap={2} mb="md">
                        <Title order={4}>24 小时分布</Title>
                        <Text size="sm" c="dimmed">一天中哪个时段最活跃</Text>
                    </Stack>
                    <Box h={CHART_HEIGHT}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#e9ecef" />
                                <PolarAngleAxis
                                    dataKey="Hour"
                                    tick={{ fontSize: 10, fill: "#868e96" }}
                                    tickFormatter={(v) => {
                                        const hour = parseInt(String(v), 10);
                                        return hour % 3 === 0 ? String(v) : "";
                                    }}
                                />
                                <PolarRadiusAxis tick={{ fontSize: 10, fill: "#adb5bd" }} />
                                <Radar
                                    dataKey="Count"
                                    stroke="#15aabf"
                                    fill="#15aabf"
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                />
                                <ChartTooltip
                                    formatter={(value) => [`${value} 次`, "次数"]}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>

                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Stack gap={2} mb="md">
                        <Title order={4}>星期分布</Title>
                        <Text size="sm" c="dimmed">每周哪天最活跃</Text>
                    </Stack>
                    <Box h={CHART_HEIGHT}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weekdayChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                                <XAxis dataKey="Day" tick={{ fontSize: 12, fill: "#868e96" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#868e96" }} allowDecimals={false} />
                                <ChartTooltip
                                    formatter={(value) => [`${value} 次`, "次数"]}
                                />
                                <Bar dataKey="Count" fill="#40c057" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>
            </SimpleGrid>

            {/* 时长分布直方图 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>时长分布</Title>
                    <Text size="sm" c="dimmed">每次持续时长（分钟）的分布</Text>
                </Stack>
                <Box h={CHART_HEIGHT}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={durationData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis
                                dataKey="Label"
                                tick={{ fontSize: 12, fill: "#868e96" }}
                                tickFormatter={(v) => `${v}分`}
                            />
                            <YAxis tick={{ fontSize: 11, fill: "#868e96" }} allowDecimals={false} />
                            <ChartTooltip
                                formatter={(value) => [`${value} 次`, "次数"]}
                                labelFormatter={(label) => `${label} 分钟`}
                            />
                            <Bar dataKey="Count" fill="#fd7e14" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Paper>

            {/* AI 数据分析 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap={2}>
                        <Group gap="xs">
                            <ThemeIcon variant="light" color="grape" size="sm">
                                <IconBrain size={14} />
                            </ThemeIcon>
                            <Title order={4}>AI 数据分析</Title>
                        </Group>
                        <Text size="sm" c="dimmed">
                            基于所有统计数据生成智能分析报告（可在设置中配置 AI 服务商）
                        </Text>
                    </Stack>
                    <Button
                        variant="light"
                        color="grape"
                        size="sm"
                        onClick={HandleAiAnalysis}
                        loading={aiLoading}
                        disabled={!hasRecords}
                    >
                        {aiResult !== null ? "重新分析" : "开始分析"}
                    </Button>
                </Group>

                {aiLoading && (
                    <Group justify="center" py="xl">
                        <Loader color="grape" size="sm" />
                        <Text size="sm" c="dimmed">正在分析数据...</Text>
                    </Group>
                )}

                {aiError !== null && (
                    <Paper p="md" radius="sm" bg="red.0">
                        <Text size="sm" c="red.7">{aiError}</Text>
                    </Paper>
                )}

                {aiResult !== null && !aiLoading && aiError === null && (
                    <Paper p="md" radius="sm" bg="grape.0">
                        <Stack gap="xs">
                            {aiResult.split("\n").filter((line) => line.trim() !== "").map((line, i) => (
                                <Text key={i} size="sm" c="dark.6" style={{ lineHeight: 1.6 }}>
                                    {line}
                                </Text>
                            ))}
                        </Stack>
                    </Paper>
                )}

                {aiResult === null && !aiLoading && aiError === null && (
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                        点击"开始分析"按钮，获取 AI 生成的数据洞察报告。
                    </Text>
                )}
            </Paper>
        </Stack>
    );
};

const ComparisonCard = ({
    label,
    myValue,
    communityValue,
    unit,
    color,
    decimals = 0,
}: {
    label: string;
    myValue: number;
    communityValue: number;
    unit: string;
    color: string;
    decimals?: number;
}) => {
    const max: number = Math.max(myValue, communityValue, 1);
    const myPercent: number = (myValue / max) * 100;
    const communityPercent: number = (communityValue / max) * 100;
    const formatVal = (v: number): string => decimals > 0 ? v.toFixed(decimals) : String(v);

    return (
        <Paper p="md" radius="md" withBorder>
            <Text size="sm" fw={500} mb="sm">{label}</Text>
            <Stack gap="xs">
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">你</Text>
                    <Text size="sm" fw={600} c={color}>{formatVal(myValue)} {unit}</Text>
                </Group>
                <Progress value={myPercent} color={color} size="sm" radius="xl" />
                <Group justify="space-between">
                    <Text size="xs" c="dimmed">社区中位数</Text>
                    <Text size="sm" fw={600} c="grape">{formatVal(communityValue)} {unit}</Text>
                </Group>
                <Progress value={communityPercent} color="grape" size="sm" radius="xl" />
            </Stack>
        </Paper>
    );
};

const StatCard = ({
    title,
    value,
    description,
    icon,
    color,
}: {
    title: string;
    value: string | number;
    description: string;
    icon: ReactNode;
    color: string;
}) => (
    <Paper shadow="sm" radius="md" p="md" withBorder>
        <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
            <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    {title}
                </Text>
                <Text size="xs" c="dimmed">
                    {description}
                </Text>
            </Stack>
            <ThemeIcon variant="light" color={color} size="md">
                {icon}
            </ThemeIcon>
        </Group>
        <Text size="26px" fw={700} c="blue">
            {value}
        </Text>
    </Paper>
);
