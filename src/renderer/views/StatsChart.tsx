import { useState, useEffect, type ReactNode } from "react";
import { Paper, Title, SimpleGrid, Stack, Text, Group, Box, Tooltip, ThemeIcon } from "@mantine/core";
import { IconChartBar, IconClock, IconDroplet, IconHistory } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import type { IStats, IDailyCount } from "@dickhelper/shared";

const DAYS_IN_WEEK: number = 7;
const WEEKS_TO_SHOW: number = 4;
const WEEKDAYS: string[] = ["一", "二", "三", "四", "五", "六", "日"];

export const StatsChart = () => {
    const [stats, setStats] = useState<IStats>({
        TotalCount: 0,
        AverageDuration: 0,
        FrequencyPerWeek: 0,
        FrequencyPerMonth: 0,
    });
    const [dailyCounts, setDailyCounts] = useState<Map<string, number>>(new Map());

    const LoadData = (): void => {
        DatabaseService.GetStats().then(setStats);

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));
        startDate.setHours(0, 0, 0, 0);

        DatabaseService.GetDailyCounts(startDate, now).then((counts: IDailyCount[]) => {
            const map = new Map<string, number>();
            for (const item of counts) {
                map.set(item.Date, item.Count);
            }
            setDailyCounts(map);
        });
    };

    useEffect(() => {
        LoadData();

        const unsubscribe = DatabaseService.OnRecordsUpdated(() => {
            LoadData();
        });

        return () => {
            unsubscribe();
        };
    }, []);

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

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    统计
                </Title>
                <Text size="sm" c="dimmed">
                    查看累计数据和最近 4 周的记录分布。
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
                        <Title order={4}>
                            发射日历
                        </Title>
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
        <Text size="26px" fw={700} c="blue">
            {value}
        </Text>
    </Paper>
);
