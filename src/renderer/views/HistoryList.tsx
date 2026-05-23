import { useState } from "react";
import {
    Paper,
    Title,
    Stack,
    Text,
    Group,
    ActionIcon,
    Modal,
    Button,
    Badge,
} from "@mantine/core";
import { IconTrash, IconEraser } from "@tabler/icons-react";
import { useRecords } from "../hooks/useRecords";
import { DatabaseService } from "../services/DatabaseService";
import type { IRecord } from "../types/IRecord";

const FormatDuration = (durationMinutes: number): string => {
    const minutes: number = Math.floor(durationMinutes);
    const seconds: number = Math.round((durationMinutes - minutes) * 60);
    return `${minutes}分${seconds}秒`;
};

export const HistoryList = () => {
    const { records, loading, refresh } = useRecords();
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

    const HandleDeleteRecord = async (id: string): Promise<void> => {
        await DatabaseService.DeleteRecord(id);
        refresh();
    };

    const HandleClearAll = async (): Promise<void> => {
        await DatabaseService.ClearAll();
        setDeleteModalOpen(false);
        refresh();
    };

    if (loading) {
        return <Text ta="center" c="dimmed">加载中...</Text>;
    }

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Group justify="space-between" align="center">
                <Stack gap={4}>
                    <Title order={3} c="blue">
                        历史
                    </Title>
                    <Text size="sm" c="dimmed">
                        查看、删除或清空已经保存的记录。
                    </Text>
                </Stack>
                {records.length > 0 && (
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        onClick={() => setDeleteModalOpen(true)}
                        title="清空所有数据"
                    >
                        <IconEraser size={20} />
                    </ActionIcon>
                )}
            </Group>

            {records.length === 0 ? (
                <Paper shadow="sm" radius="md" p="xl" withBorder>
                    <Text ta="center" fw={600} size="lg">
                        暂无记录
                    </Text>
                    <Text ta="center" c="dimmed" size="sm" mt="xs">
                        开始记录你的第一次手艺活吧
                    </Text>
                </Paper>
            ) : (
                <Stack gap="sm">
                    {records.map((record: IRecord) => (
                        <Paper key={record.Id} shadow="xs" radius="md" p="md" withBorder>
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                                <Stack gap={6} style={{ flex: 1 }}>
                                    <Group gap="xs" wrap="wrap">
                                        <Text size="sm" fw={600}>
                                            {record.EndTime.toLocaleString()}
                                        </Text>
                                        <Badge
                                            variant="light"
                                            color="blue"
                                            size="sm"
                                        >
                                            {FormatDuration(record.Duration)}
                                        </Badge>
                                    </Group>
                                    <Text size="sm" c="dimmed" lineClamp={2}>
                                        {record.Notes || "无备注"}
                                    </Text>
                                </Stack>
                                <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => HandleDeleteRecord(record.Id)}
                                    title="删除"
                                    aria-label="删除记录"
                                >
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            )}

            <Modal
                opened={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="确认清空数据"
                centered
            >
                <Text mb="lg">确定要删除所有记录吗？此操作不可恢复。</Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
                        取消
                    </Button>
                    <Button color="red" onClick={HandleClearAll}>
                        确认清空
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
};
