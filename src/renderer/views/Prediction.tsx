import { useEffect, useState } from "react";
import { Badge, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconBolt, IconClock, IconFlame, IconMoon, IconSun } from "@tabler/icons-react";
import { useRecords } from "../hooks/useRecords";
import { PredictionService, type IPrediction, type PredictionLevel } from "../services/PredictionService";

function FormatDuration(days: number): string {
    if (days <= 0) {
        return "今天";
    }

    if (days < 1) {
        return `${Math.round(days * 24)} 小时`;
    }

    return `${days.toFixed(1)} 天`;
}

function FormatInterval(days: number): string {
    if (days <= 0) {
        return "--";
    }

    return `${days.toFixed(1)} 天`;
}

function FormatCountdown(target: Date | null): string {
    if (target === null) {
        return "--";
    }

    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) {
        return "已到";
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days} 天 ${hours % 24} 小时`;
    }

    return `${hours} 小时 ${minutes} 分钟`;
}

function FormatEstimate(target: Date | null): string {
    if (target === null) {
        return "暂无";
    }

    const month = target.getMonth() + 1;
    const day = target.getDate();
    const hour = String(target.getHours()).padStart(2, "0");
    return `${month}/${day} ${hour}:00`;
}

function GetLevelConfig(level: PredictionLevel): { color: string; label: string; icon: typeof IconSun } {
    switch (level) {
        case "medium":
            return { color: "yellow", label: "中", icon: IconMoon };
        case "high":
            return { color: "orange", label: "高", icon: IconBolt };
        case "veryHigh":
            return { color: "red", label: "很高", icon: IconFlame };
        case "low":
        default:
            return { color: "green", label: "低", icon: IconSun };
    }
}

function GetActiveHourText(prediction: IPrediction): string {
    if (prediction.PeakHour === undefined) {
        return "记录还不够多，暂时看不出稳定的高峰时段。";
    }

    return `最常出现的时段大约是 ${String(prediction.PeakHour).padStart(2, "0")}:00。`;
}

export const Prediction = () => {
    const { records, loading } = useRecords();
    const [countdown, setCountdown] = useState<string>("--");

    const prediction = PredictionService.Analyze(records);
    const levelConfig = GetLevelConfig(prediction.Level);
    const LevelIcon = levelConfig.icon;
    const nextEstimateTime = prediction.NextEstimate?.getTime() ?? 0;

    useEffect(() => {
        setCountdown(FormatCountdown(prediction.NextEstimate));

        if (prediction.NextEstimate === null) {
            return;
        }

        const timer = window.setInterval(() => {
            setCountdown(FormatCountdown(prediction.NextEstimate));
        }, 60_000);

        return () => {
            window.clearInterval(timer);
        };
    }, [nextEstimateTime]);

    if (loading) {
        return (
            <Stack gap="md" maw={860} mx="auto">
                <Stack gap={4}>
                    <Title order={3}>精力预测</Title>
                    <Text size="sm" c="dimmed">
                        正在加载记录…
                    </Text>
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3}>精力预测</Title>
                <Text size="sm" c="dimmed">
                    基于历史记录给出一个简单的时间判断。
                </Text>
            </Stack>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                    <Stack gap="sm">
                        <Group gap="sm" align="center">
                            <ThemeIcon size={44} radius="xl" variant="light" color={levelConfig.color}>
                                <LevelIcon size={22} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" c="dimmed">
                                    当前判断
                                </Text>
                                <Text size="lg" fw={700} c={levelConfig.color}>
                                    {levelConfig.label}
                                </Text>
                            </Stack>
                        </Group>

                        <Group gap="lg" align="flex-start" wrap="wrap">
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    距上次
                                </Text>
                                <Text fw={600}>{FormatDuration(prediction.DaysSinceLast)}</Text>
                            </Stack>

                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    平均间隔
                                </Text>
                                <Text fw={600}>{FormatInterval(prediction.AverageInterval)}</Text>
                            </Stack>

                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">
                                    预计下次
                                </Text>
                                <Text fw={600}>{countdown}</Text>
                            </Stack>
                        </Group>
                    </Stack>

                    <Badge variant="light" color={levelConfig.color} size="lg">
                        {levelConfig.label}
                    </Badge>
                </Group>

                <Text size="sm" c="dimmed" mt="md">
                    {prediction.NextEstimate
                        ? `大致会落在 ${FormatEstimate(prediction.NextEstimate)} 左右。`
                        : "样本还少，继续记录后再看趋势会更可靠。"}
                </Text>
            </Paper>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group gap="sm" mb="sm">
                    <IconClock size={18} />
                    <Title order={4}>活跃时段</Title>
                </Group>
                <Text size="sm" c="dimmed">
                    {GetActiveHourText(prediction)}
                </Text>
            </Paper>
        </Stack>
    );
};
