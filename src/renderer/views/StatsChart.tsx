import { useState, useEffect } from "react";
import { Paper, Title, SimpleGrid, Stack, Text, Group, Box, Tooltip } from "@mantine/core";
import { DatabaseService } from "../services/DatabaseService";
import type { IStats, IDailyCount } from "../types/IRecord";

const DAYS_IN_WEEK: number = 7;
const WEEKS_TO_SHOW: number = 4;
const WEEKDAYS: string[] = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * 统计看板组件
 * 展示 4 个统计卡片和发射日历热力图（4 周 x 7 天，纯 CSS 色块）
 * 统计数据通过 SQL 查询获取，不在 JS 中遍历数组
 */
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

        // 计算热力图日期范围：4 周前到今天
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

    // 获取贡献等级 0-4
    const GetContributionLevel = (count: number): number => {
        if (count === 0) return 0;
        if (count === 1) return 1;
        if (count === 2) return 2;
        if (count === 3) return 3;
        return 4;
    };

    // 生成热力图数据：4 周 x 7 天的二维数组
    const GenerateHeatmapData = (): { date: Date; count: number }[][] => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        // 最早日期：28 天前
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));

        const data: { date: Date; count: number }[][] = [];
        for (let week = 0; week < WEEKS_TO_SHOW; week++) {
            const weekData: { date: Date; count: number }[] = [];
            for (let day = 0; day < DAYS_IN_WEEK; day++) {
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + week * DAYS_IN_WEEK + day);
                const dateKey: string = cellDate.toISOString().slice(0, 10);
                weekData.push({
                    date: cellDate,
                    count: dailyCounts.get(dateKey) ?? 0,
                });
            }
            data.push(weekData);
        }
        return data;
    };

    // 贡献颜色：5 级绿色
    const ContributionColor = (level: number): string => {
        const colors: string[] = [
            "rgba(235, 237, 240, 0.5)", // 0
            "rgba(155, 233, 168, 0.5)", // 1
            "rgba(64, 196, 99, 0.6)",  // 2
            "rgba(48, 161, 78, 0.8)",  // 3
            "rgba(33, 110, 57, 0.9)",  // 4
        ];
        return colors[level]!;
    };

    // 月份标签
    const GetMonthLabels = (): { label: string; weekIndex: number }[] => {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW - 1));
        const labels: { label: string; weekIndex: number }[] = [];

        for (let week = 0; week < WEEKS_TO_SHOW; week++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + week * 7);
            const monthName = date.getMonth() + 1;
            // 新月份的第一个完整周显示标签
            if (week === 0 || date.getDate() <= 7) {
                labels.push({ label: `${monthName}月`, weekIndex: week });
            }
        }
        return labels;
    };

    const heatmapData = GenerateHeatmapData();
    const monthLabels = GetMonthLabels();

    return (
        <Stack gap="lg">
            <Title order={3} ta="center" c="blue">
                统计数据
            </Title>

            {/* 统计卡片 */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <StatCard title="总次数" value={stats.TotalCount} />
                <StatCard
                    title="平均时长"
                    value={`${stats.AverageDuration.toFixed(1)} 分钟`}
                />
                <StatCard title="本周次数" value={stats.FrequencyPerWeek} />
                <StatCard title="本月次数" value={stats.FrequencyPerMonth} />
            </SimpleGrid>

            {/* 热力图 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Title order={4} ta="center" mb="md">
                    发射日历
                </Title>

                <Group gap="xs" wrap="nowrap" align="flex-start" justify="center">
                    {/* 月份标签列 */}
                    <Stack gap={0} pt={24}>
                        {monthLabels.map((label, i) => (
                            <Text key={i} size="xs" c="dimmed" lh={1.2}>
                                {label.label}
                            </Text>
                        ))}
                    </Stack>

                    <Stack gap={0}>
                        {/* 星期标签 */}
                        <Group gap={2} mb={4}>
                            {WEEKDAYS.map((day, i) => (
                                <Text key={i} size="xs" c="dimmed" ta="center" w={16}>
                                    {day}
                                </Text>
                            ))}
                        </Group>

                        {/* 热力图网格 */}
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
                                                    w={16}
                                                    h={16}
                                                    style={{
                                                        backgroundColor: ContributionColor(level),
                                                        borderRadius: 2,
                                                        border: "1px solid rgba(27, 31, 35, 0.06)",
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

// 统计卡片子组件
const StatCard = ({ title, value }: { title: string; value: string | number }) => (
    <Paper shadow="sm" radius="md" p="md" withBorder>
        <Text size="sm" c="dimmed" mb={4}>
            {title}
        </Text>
        <Text size="xl" fw={700} c="blue">
            {value}
        </Text>
    </Paper>
);
