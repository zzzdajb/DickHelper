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
    Box,
} from "@mantine/core";
import { IconTrash, IconEraser } from "@tabler/icons-react";
import { useRecords } from "../hooks/useRecords";
import { DatabaseService } from "../services/DatabaseService";
import type { IRecord } from "../types/IRecord";

/**
 * 历史记录列表组件
 * 倒序显示所有记录，支持单条删除和清空全部（带确认对话框）
 * 通过 IPC 事件自动刷新
 */
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

    // 格式化时长为 "X分X秒"
    const FormatDuration = (durationMinutes: number): string => {
        const minutes: number = Math.floor(durationMinutes);
        const seconds: number = Math.round((durationMinutes - minutes) * 60);
        return `${minutes}分${seconds}秒`;
    };

    if (loading) {
        return <Text ta="center">加载中...</Text>;
    }

    return (
        <Stack gap="md">
            <Group justify="space-between" align="center">
                <Title order={3} c="blue">
                    历史记录
                </Title>
                <ActionIcon
                    variant="light"
                    color="red"
                    size="lg"
                    onClick={() => setDeleteModalOpen(true)}
                    title="清空所有数据"
                >
                    <IconEraser size={20} />
                </ActionIcon>
            </Group>

            <Stack gap="sm">
                {/* 倒序显示（返回的数据已经是倒序，直接遍历） */}
                {records.length === 0 ? (
                    <Text ta="center" c="dimmed" py="xl">
                        暂无记录
                    </Text>
                ) : (
                    records.map((record: IRecord) => (
                        <Paper key={record.Id} shadow="xs" radius="md" p="md" withBorder>
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <Text size="sm" fw={600} c="blue" mb={4}>
                                        {record.EndTime.toLocaleString()}
                                    </Text>
                                    <Group gap="sm">
                                        <Text
                                            size="sm"
                                            style={{
                                                backgroundColor: "rgba(33, 150, 243, 0.1)",
                                                padding: "2px 8px",
                                                borderRadius: 4,
                                            }}
                                        >
                                            持续时间：{FormatDuration(record.Duration)}
                                        </Text>
                                        {record.Notes && (
                                            <Text
                                                size="sm"
                                                c="dimmed"
                                                style={{
                                                    backgroundColor: "rgba(0, 0, 0, 0.04)",
                                                    padding: "2px 8px",
                                                    borderRadius: 4,
                                                }}
                                            >
                                                备注：{record.Notes}
                                            </Text>
                                        )}
                                    </Group>
                                </Box>
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => HandleDeleteRecord(record.Id)}
                                    title="删除"
                                >
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </Group>
                        </Paper>
                    ))
                )}
            </Stack>

            {/* 清空确认对话框 */}
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
