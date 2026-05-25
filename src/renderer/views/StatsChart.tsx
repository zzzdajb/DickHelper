import { useEffect, useState, type ReactNode } from "react";
import {
    Paper,
    Title,
    SimpleGrid,
    Stack,
    Text,
    Group,
    Box,
    Tooltip,
    ThemeIcon,
    Button,
    Loader,
} from "@mantine/core";
import { IconBrain, IconChartBar, IconClock, IconDroplet, IconHistory } from "@tabler/icons-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    BarChart,
    Bar,
} from "recharts";
import { DatabaseService } from "../services/DatabaseService";
import type { IDailyCount, IHourlyCount, IMonthlyCount, IStats, IWeekdayCount } from "@dickhelper/shared";

const DAYS_IN_WEEK: number = 7;
const WEEKS_TO_SHOW: number = 4;
const WEEKDAYS: string[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_FULL: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const TREND_DAYS: number = 90;
const CHART_HEIGHT: number = 280;

const DURATION_BINS: { Label: string; Min: number; Max: number }[] = [
    { Label: "0-5", Min: 0, Max: 5 },
    { Label: "5-10", Min: 5, Max: 10 },
    { Label: "10-15", Min: 10, Max: 15 },
    { Label: "15-20", Min: 15, Max: 20 },
    { Label: "20-30", Min: 20, Max: 30 },
    { Label: "30+", Min: 30, Max: Number.POSITIVE_INFINITY },
];

const BuildDateKey = (date: Date): string => {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, "0");
    const day: string = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const FillDailyGaps = (counts: IDailyCount[], days: number): { Date: string; Count: number }[] => {
    const map = new Map<string, number>();
    for (const item of counts) {
        map.set(item.Date, item.Count);
    }

    const result: { Date: string; Count: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let offset = days - 1; offset >= 0; offset--) {
        const date = new Date(now);
        date.setDate(date.getDate() - offset);
        const key = BuildDateKey(date);
        result.push({ Date: key, Count: map.get(key) ?? 0 });
    }

    return result;
};

const BuildDurationBins = (durations: number[]): { Label: string; Count: number }[] => {
    return DURATION_BINS.map((bin) => ({
        Label: bin.Label,
        Count: durations.filter((duration) => duration >= bin.Min && duration < bin.Max).length,
    }));
};

export const StatsChart = () => {
    const [stats, setStats] = useState<IStats>({
        TotalCount: 0,
        AverageDuration: 0,
        FrequencyPerWeek: 0,
        FrequencyPerMonth: 0,
    });
    const [dailyCounts, setDailyCounts] = useState<Map<string, number>>(new Map());
    const [trendData, setTrendData] = useState<{ Date: string; Count: number }[]>([]);
    const [hourlyData, setHourlyData] = useState<IHourlyCount[]>([]);
    const [weekdayData, setWeekdayData] = useState<IWeekdayCount[]>([]);
    const [monthlyData, setMonthlyData] = useState<IMonthlyCount[]>([]);
    const [durationData, setDurationData] = useState<{ Label: string; Count: number }[]>([]);
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiError, setAiError] = useState<string | null>(null);

    useEffect(() => {
        const HandleLoadError = (label: string) => (error: unknown): void => {
            console.error(`[StatsChart] ${label}`, error);
        };

        const LoadData = (): void => {
            void DatabaseService.GetStats().then(setStats).catch(HandleLoadError("GetStats"));

            const now = new Date();
            now.setHours(23, 59, 59, 999);

            const heatmapStart = new Date(now);
            heatmapStart.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));
            heatmapStart.setHours(0, 0, 0, 0);

            void DatabaseService.GetDailyCounts(heatmapStart, now)
                .then((counts: IDailyCount[]) => {
                    const map = new Map<string, number>();
                    for (const item of counts) {
                        map.set(item.Date, item.Count);
                    }
                    setDailyCounts(map);
                })
                .catch(HandleLoadError("GetDailyCounts"));

            const trendStart = new Date(now);
            trendStart.setDate(now.getDate() - (TREND_DAYS - 1));
            trendStart.setHours(0, 0, 0, 0);

            void DatabaseService.GetDailyCounts(trendStart, now)
                .then((counts: IDailyCount[]) => {
                    setTrendData(FillDailyGaps(counts, TREND_DAYS));
                })
                .catch(HandleLoadError("GetDailyCountsTrend"));

            void DatabaseService.GetHourlyDistribution().then(setHourlyData).catch(HandleLoadError("GetHourlyDistribution"));
            void DatabaseService.GetWeekdayDistribution().then(setWeekdayData).catch(HandleLoadError("GetWeekdayDistribution"));
            void DatabaseService.GetMonthlyTrend().then(setMonthlyData).catch(HandleLoadError("GetMonthlyTrend"));
            void DatabaseService.GetDurationDistribution()
                .then((durations: number[]) => {
                    setDurationData(BuildDurationBins(durations));
                })
                .catch(HandleLoadError("GetDurationDistribution"));
        };

        LoadData();

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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setAiError(message);
        } finally {
            setAiLoading(false);
        }
    };

    const GetContributionLevel = (count: number): number => {
        if (count === 0) return 0;
        if (count === 1) return 1;
        if (count === 2) return 2;
        if (count === 3) return 3;
        return 4;
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
                const dateKey = BuildDateKey(cellDate);
                weekData.push({
                    date: cellDate,
                    count: dailyCounts.get(dateKey) ?? 0,
                });
            }
            data.push(weekData);
        }
        return data;
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
    const radarData = hourlyData.map((item) => ({ Hour: `${item.Hour}时`, Count: item.Count }));
    const weekdayChartData = weekdayData.map((item, index) => ({ Day: WEEKDAY_FULL[index] ?? `${item.Weekday}`, Count: item.Count }));
    const monthlyChartData = monthlyData.map((item) => ({ Month: item.Month.slice(5), Count: item.Count }));

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

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap={2}>
                        <Title order={4}>发射日历</Title>
                        <Text size="sm" c="dimmed">
                            颜色越深，代表当天记录次数越多。
                        </Text>
                    </Stack>
                    {!hasRecords && (
                        <Text size="sm" c="dimmed">
                            暂无可统计数据
                        </Text>
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
                            {WEEKDAYS.map((day) => (
                                <Text key={day} size="xs" c="dimmed" ta="center" w={18}>
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

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>90 天趋势</Title>
                    <Text size="sm" c="dimmed">
                        最近 90 天的频率变化
                    </Text>
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
                                tickFormatter={(value) => String(value).slice(5)}
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

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>月度对比</Title>
                    <Text size="sm" c="dimmed">
                        最近 12 个月的频率对比
                    </Text>
                </Stack>
                <Box h={CHART_HEIGHT}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis
                                dataKey="Month"
                                tick={{ fontSize: 11, fill: "#868e96" }}
                                tickFormatter={(value) => `${value}月`}
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

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Stack gap={2} mb="md">
                        <Title order={4}>24 小时分布</Title>
                        <Text size="sm" c="dimmed">
                            一天中哪个时段最活跃
                        </Text>
                    </Stack>
                    <Box h={CHART_HEIGHT}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#e9ecef" />
                                <PolarAngleAxis
                                    dataKey="Hour"
                                    tick={{ fontSize: 10, fill: "#868e96" }}
                                    tickFormatter={(value) => {
                                        const hour = Number.parseInt(String(value), 10);
                                        return hour % 3 === 0 ? String(value) : "";
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
                        <Text size="sm" c="dimmed">
                            每周哪天最活跃
                        </Text>
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

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>时长分布</Title>
                    <Text size="sm" c="dimmed">
                        每次持续时长（分钟）的分布
                    </Text>
                </Stack>
                <Box h={CHART_HEIGHT}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={durationData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                            <XAxis
                                dataKey="Label"
                                tick={{ fontSize: 12, fill: "#868e96" }}
                                tickFormatter={(value) => `${value}分`}
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
                            基于所有统计数据生成智能分析报告。
                        </Text>
                    </Stack>
                    <Button
                        variant="light"
                        color="grape"
                        size="sm"
                        onClick={HandleAiAnalysis}
                        loading={aiLoading}
                    >
                        {aiResult !== null ? "重新分析" : "开始分析"}
                    </Button>
                </Group>

                {aiLoading && (
                    <Group justify="center" py="xl">
                        <Loader color="grape" size="sm" />
                        <Text size="sm" c="dimmed">
                            正在分析数据...
                        </Text>
                    </Group>
                )}

                {aiError !== null && (
                    <Paper p="md" radius="sm" bg="red.0">
                        <Text size="sm" c="red.7" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {aiError}
                        </Text>
                    </Paper>
                )}

                {aiResult !== null && !aiLoading && aiError === null && (
                    <Paper p="md" radius="sm" bg="grape.0">
                        <Stack gap="xs">
                            {aiResult
                                .split("\n")
                                .filter((line) => line.trim() !== "")
                                .map((line, i) => (
                                    <Text key={i} size="sm" c="gray.8" style={{ lineHeight: 1.6 }}>
                                        {line}
                                    </Text>
                                ))}
                        </Stack>
                    </Paper>
                )}

                {aiResult === null && !aiLoading && aiError === null && (
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                        点击“开始分析”按钮，获取 AI 生成的数据洞察报告。
                    </Text>
                )}
            </Paper>
        </Stack>
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
        <Text size="26px" fw={700} c={color} style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
        </Text>
    </Paper>
);
