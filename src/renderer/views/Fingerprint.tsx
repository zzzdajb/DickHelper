import { useState, useEffect, useRef, useCallback } from "react";
import { Paper, Title, Stack, Text, Group, Button, Badge, SimpleGrid, Box } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { FingerprintService } from "../services/FingerprintService";
import type { IRecord } from "@dickhelper/shared";

const DAY_LABELS: string[] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const DAY_COLORS: string[] = [
    "#4a90d9", "#45b5aa", "#4caf50",
    "#d4a843", "#e67e22", "#e84393", "#9b59b6",
];

const CANVAS_SIZE = 400;

export const Fingerprint = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [records, setRecords] = useState<IRecord[]>([]);
    const [stats, setStats] = useState<{
        total: number;
        uniqueDays: number;
        favoriteHour: number;
        favoriteDay: number;
    }>({ total: 0, uniqueDays: 0, favoriteHour: 0, favoriteDay: 0 });

    const LoadData = useCallback(async (): Promise<void> => {
        const data = await DatabaseService.GetRecords();
        setRecords(data);
        if (data.length > 0) {
            setStats(CalcStats(data));
        }
    }, []);

    useEffect(() => {
        LoadData();
        const unsubscribe = DatabaseService.OnRecordsUpdated(() => { LoadData(); });
        return () => { unsubscribe(); };
    }, [LoadData]);

    useEffect(() => {
        if (canvasRef.current) {
            FingerprintService.Render(canvasRef.current, records, { Size: CANVAS_SIZE });
        }
    }, [records]);

    const HandleDownload = (): void => {
        if (!canvasRef.current) return;
        const dataUrl = FingerprintService.ToDataUrl(canvasRef.current);
        const link = document.createElement("a");
        link.download = `dick-fingerprint-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
    };

    return (
        <Stack gap="lg" maw={860} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">JB 指纹</Title>
                <Text size="sm" c="dimmed">
                    基于所有历史数据生成的独一无二的可视化图案。角度 = 时刻，半径 = 时长，颜色 = 星期。
                </Text>
            </Stack>

            {/* 指纹画布 */}
            <Paper shadow="md" radius="lg" p="xl" withBorder
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    background: "linear-gradient(135deg, #0a0a1a05, #1a1a2e08)",
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        borderRadius: 16,
                        maxWidth: "100%",
                    }}
                />

                <Group mt="md" gap="sm">
                    <Button
                        variant="light"
                        leftSection={<IconDownload size={16} />}
                        onClick={HandleDownload}
                        disabled={records.length === 0}
                    >
                        保存图片
                    </Button>
                    <Button
                        variant="subtle"
                        leftSection={<IconRefresh size={16} />}
                        onClick={LoadData}
                    >
                        刷新
                    </Button>
                </Group>
            </Paper>

            {/* 图例 */}
            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Title order={4} mb="md">颜色图例</Title>
                <Group gap="md" wrap="wrap">
                    {DAY_LABELS.map((label, i) => (
                        <Group key={i} gap={6}>
                            <Box style={{
                                width: 12, height: 12, borderRadius: 3,
                                backgroundColor: DAY_COLORS[i],
                            }} />
                            <Text size="sm" c="dimmed">{label}</Text>
                        </Group>
                    ))}
                </Group>
                <Stack gap={4} mt="md">
                    <Text size="xs" c="dimmed">角度：一天中的时刻 (顶部=0:00, 右侧=6:00, 底部=12:00, 左侧=18:00)</Text>
                    <Text size="xs" c="dimmed">半径：时长越长越靠外圈</Text>
                    <Text size="xs" c="dimmed">中心数字：总记录数</Text>
                </Stack>
            </Paper>

            {/* 指纹数据摘要 */}
            {records.length > 0 && (
                <Paper shadow="sm" radius="md" p="lg" withBorder>
                    <Title order={4} mb="md">指纹摘要</Title>
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                        <Stack gap={2} align="center">
                            <Text size="xl" fw={700} c="blue">{stats.total}</Text>
                            <Text size="xs" c="dimmed">总数据点</Text>
                        </Stack>
                        <Stack gap={2} align="center">
                            <Text size="xl" fw={700} c="cyan">{stats.uniqueDays}</Text>
                            <Text size="xs" c="dimmed">活跃天数</Text>
                        </Stack>
                        <Stack gap={2} align="center">
                            <Group gap={4}>
                                <Text size="xl" fw={700} c="green">{stats.favoriteHour}:00</Text>
                            </Group>
                            <Text size="xs" c="dimmed">最活跃时段</Text>
                        </Stack>
                        <Stack gap={2} align="center">
                            <Badge color={DAY_COLORS[stats.favoriteDay]} variant="filled" size="lg">
                                {DAY_LABELS[stats.favoriteDay]}
                            </Badge>
                            <Text size="xs" c="dimmed">最活跃星期</Text>
                        </Stack>
                    </SimpleGrid>
                </Paper>
            )}
        </Stack>
    );
};

function CalcStats(records: IRecord[]): {
    total: number;
    uniqueDays: number;
    favoriteHour: number;
    favoriteDay: number;
} {
    const daySet = new Set<string>();
    const hourCounts = new Array<number>(24).fill(0);
    const weekdayCounts = new Array<number>(7).fill(0);

    for (const r of records) {
        const d = r.EndTime;
        const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        daySet.add(dateKey);
        hourCounts[d.getHours()]!++;
        weekdayCounts[(d.getDay() + 6) % 7]!++;
    }

    const favoriteHour = hourCounts.indexOf(hourCounts.reduce((a, b) => Math.max(a, b), 0));
    const favoriteDay = weekdayCounts.indexOf(weekdayCounts.reduce((a, b) => Math.max(a, b), 0));

    return {
        total: records.length,
        uniqueDays: daySet.size,
        favoriteHour,
        favoriteDay,
    };
}
