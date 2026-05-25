import { useState, useEffect, useCallback } from "react";
import { Paper, Title, Stack, Text, Group, Box, SimpleGrid, ThemeIcon, RingProgress, Badge } from "@mantine/core";
import { IconBolt, IconClock, IconFlame, IconMoon, IconSun, IconCalendar } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { PredictionService, type IPrediction } from "../services/PredictionService";
import type { IRecord } from "@dickhelper/shared";

const WEEKDAY_LABELS: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const HOUR_LABELS: string[] = [
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
    "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
];

function FormatCountdown(target: Date | null): string {
    if (!target) return "--";
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return "随时可能";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days}天${hours % 24}小时`;
    }
    return `${hours}小时${minutes}分钟`;
}

function GetWeatherIcon(probability: number): typeof IconSun {
    if (probability >= 80) return IconFlame;
    if (probability >= 50) return IconBolt;
    if (probability >= 30) return IconMoon;
    return IconSun;
}

function GetWeatherLabel(probability: number): string {
    if (probability >= 80) return "欲望暴风雨";
    if (probability >= 50) return "蠢蠢欲动";
    if (probability >= 30) return "微风徐徐";
    return "风平浪静";
}

function GetWeatherColor(probability: number): string {
    if (probability >= 80) return "red";
    if (probability >= 50) return "orange";
    if (probability >= 30) return "yellow";
    return "green";
}

export const Prediction = () => {
    const [prediction, setPrediction] = useState<IPrediction | null>(null);
    const [countdown, setCountdown] = useState<string>("--");

    const LoadData = useCallback(async (): Promise<void> => {
        const records: IRecord[] = await DatabaseService.GetRecords();
        const result = PredictionService.Analyze(records);
        setPrediction(result);
        setCountdown(FormatCountdown(result.NextEstimate));
    }, []);

    useEffect(() => {
        LoadData();
        const unsubscribe = DatabaseService.OnRecordsUpdated(() => { LoadData(); });
        return () => { unsubscribe(); };
    }, [LoadData]);

    useEffect(() => {
        if (!prediction?.NextEstimate) return;
        setCountdown(FormatCountdown(prediction.NextEstimate));
        const timer = window.setInterval(() => {
            setCountdown(FormatCountdown(prediction.NextEstimate));
        }, 60_000);
        return () => { clearInterval(timer); };
    }, [prediction?.NextEstimate]);

    if (!prediction) return null;

    const WeatherIcon = GetWeatherIcon(prediction.Probability);
    const weatherLabel = GetWeatherLabel(prediction.Probability);
    const weatherColor = GetWeatherColor(prediction.Probability);

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">精力预测</Title>
                <Text size="sm" c="dimmed">基于历史数据分析你的行为模式，预测下次最可能的时间。</Text>
            </Stack>

            {/* 主预测卡片 - 天气预报风格 */}
            <Paper shadow="md" radius="lg" p="xl" withBorder
                style={{ background: "linear-gradient(135deg, #667eea11, #764ba211)" }}
            >
                <Group justify="space-between" align="center" wrap="nowrap">
                    <Stack gap="xs">
                        <Group gap="sm" align="center">
                            <ThemeIcon size={48} radius="xl" variant="light" color={weatherColor}>
                                <WeatherIcon size={28} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" c="dimmed" fw={500}>今日预报</Text>
                                <Text size="lg" fw={700} c={weatherColor}>{weatherLabel}</Text>
                            </Stack>
                        </Group>
                        <Group gap="lg" mt="xs">
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">距上次</Text>
                                <Text fw={600}>
                                    {prediction.DaysSinceLast < 1
                                        ? `${Math.round(prediction.DaysSinceLast * 24)}小时`
                                        : `${prediction.DaysSinceLast.toFixed(1)}天`
                                    }
                                </Text>
                            </Stack>
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">平均间隔</Text>
                                <Text fw={600}>{prediction.AverageInterval.toFixed(1)}天</Text>
                            </Stack>
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">连续天数</Text>
                                <Text fw={600}>{prediction.Streak}天</Text>
                            </Stack>
                        </Group>
                    </Stack>

                    <RingProgress
                        size={120}
                        thickness={10}
                        roundCaps
                        sections={[{ value: prediction.Probability, color: weatherColor }]}
                        label={
                            <Stack gap={0} align="center">
                                <Text size="xl" fw={700}>{prediction.Probability}%</Text>
                                <Text size="xs" c="dimmed">概率</Text>
                            </Stack>
                        }
                    />
                </Group>

                <Paper radius="md" p="md" mt="md" withBorder bg="rgba(0,0,0,0.02)">
                    <Group justify="space-between" align="center">
                        <Group gap="sm">
                            <IconClock size={18} color="gray" />
                            <Text size="sm" c="dimmed">预计下次发射</Text>
                        </Group>
                        <Group gap="sm">
                            <Text fw={600} size="lg">{countdown}</Text>
                            {prediction.NextEstimate && (
                                <Badge variant="light" color="blue" size="sm">
                                    约 {prediction.NextEstimate.getMonth() + 1}/{prediction.NextEstimate.getDate()} {prediction.NextEstimate.getHours()}:00
                                </Badge>
                            )}
                        </Group>
                    </Group>
                </Paper>
            </Paper>

            {/* 24 小时欲望曲线 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Stack gap={2} mb="md">
                    <Title order={4}>24 小时欲望曲线</Title>
                    <Text size="sm" c="dimmed">
                        峰值时段: {prediction.PeakHour}:00 (概率 {prediction.PeakProbability}%)
                    </Text>
                </Stack>

                <Box style={{ position: "relative", height: 120 }}>
                    <Group gap={1} align="flex-end" style={{ height: "100%" }} wrap="nowrap">
                        {prediction.HourlyCurve.map((value, hour) => {
                            const isNow = new Date().getHours() === hour;
                            const isPeak = hour === prediction.PeakHour;
                            return (
                                <Box key={hour} style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    height: "100%",
                                    justifyContent: "flex-end",
                                }}>
                                    <Box style={{
                                        width: "100%",
                                        maxWidth: 16,
                                        height: `${Math.max(2, value)}%`,
                                        borderRadius: "4px 4px 0 0",
                                        background: isPeak
                                            ? "linear-gradient(180deg, #ff6b6b, #ee5a24)"
                                            : isNow
                                                ? "linear-gradient(180deg, #74b9ff, #0984e3)"
                                                : `rgba(116, 185, 255, ${0.2 + value / 150})`,
                                        transition: "height 0.3s ease",
                                    }} />
                                </Box>
                            );
                        })}
                    </Group>
                    <Group gap={1} mt={4} wrap="nowrap">
                        {HOUR_LABELS.map((label, i) => (
                            <Text key={i} size="9px" c="dimmed" ta="center" style={{ flex: 1 }}>
                                {i % 3 === 0 ? label : ""}
                            </Text>
                        ))}
                    </Group>
                </Box>
            </Paper>

            {/* 星期热度 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Title order={4} mb="md">星期热度</Title>
                <SimpleGrid cols={7} spacing="xs">
                    {prediction.WeeklyCurve.map((value, day) => {
                        const isToday = (new Date().getDay() + 6) % 7 === day;
                        return (
                            <Stack key={day} gap={4} align="center">
                                <Box style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: `rgba(116, 185, 255, ${0.1 + value / 130})`,
                                    border: isToday ? "2px solid #228be6" : "2px solid transparent",
                                }}>
                                    <Text size="sm" fw={600} c={value > 60 ? "blue" : "dimmed"}>
                                        {value}
                                    </Text>
                                </Box>
                                <Text size="xs" c={isToday ? "blue" : "dimmed"} fw={isToday ? 700 : 400}>
                                    {WEEKDAY_LABELS[day]}
                                </Text>
                            </Stack>
                        );
                    })}
                </SimpleGrid>
            </Paper>

            {/* 分析师建议 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group gap="sm" mb="sm">
                    <IconCalendar size={18} />
                    <Title order={4}>分析师建议</Title>
                </Group>
                <Text size="sm" c="dimmed">
                    {GenerateAdvice(prediction)}
                </Text>
            </Paper>
        </Stack>
    );
};

function GenerateAdvice(p: IPrediction): string {
    if (p.Probability === 0) {
        return "数据不足，无法分析。继续记录以获得更准确的预测。";
    }

    const parts: string[] = [];

    if (p.DaysSinceLast > p.AverageInterval * 1.5) {
        parts.push(`已超出平均间隔 ${((p.DaysSinceLast / p.AverageInterval - 1) * 100).toFixed(0)}%，近期概率较高。`);
    } else if (p.DaysSinceLast < p.AverageInterval * 0.3) {
        parts.push("刚刚释放不久，建议休息恢复。");
    }

    parts.push(`你最活跃的时段是 ${p.PeakHour}:00 前后，${WEEKDAY_LABELS[(new Date().getDay() + 6) % 7]} 的历史活跃度为 ${p.WeeklyCurve[(new Date().getDay() + 6) % 7]}%。`);

    if (p.Streak >= 3) {
        parts.push(`已连续 ${p.Streak} 天活跃，注意适度。`);
    }

    return parts.join(" ");
}
