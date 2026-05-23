import { useState, useRef } from "react";
import {
    Paper,
    Stack,
    Title,
    Button,
    Group,
    Text,
    Notification,
    rem,
    Divider,
    Badge,
} from "@mantine/core";
import { IconDownload, IconUpload, IconDatabase, IconInfoCircle } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";

export const Settings = () => {
    const { records, refresh } = useRecords();
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const HandleExport = async (): Promise<void> => {
        const allRecords = await DatabaseService.GetRecords();
        const jsonText: string = DatabaseService.ExportToJson(allRecords);
        const blob = new Blob([jsonText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "masturbation_records.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const HandleImport = async (file: File | null): Promise<void> => {
        if (file === null) return;
        try {
            const text = await file.text();
            const result = await DatabaseService.ImportFromJson(text);
            const msg: string = `导入完成：成功 ${result.Imported} 条，跳过 ${result.Skipped} 条重复，拒绝 ${result.Rejected} 条无效数据`;
            ShowImportMessage(msg);
            refresh();
        } catch {
            ShowImportMessage("导入失败：数据格式不正确");
        }
    };

    const ShowImportMessage = (msg: string): void => {
        setImportMessage(msg);
        if (importTimerRef.current !== null) {
            clearTimeout(importTimerRef.current);
        }
        importTimerRef.current = setTimeout(() => {
            setImportMessage(null);
        }, 5000);
    };

    const HandleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file !== null && file !== undefined) {
            HandleImport(file);
        }
        e.target.value = "";
    };

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    设置
                </Title>
                <Text size="sm" c="dimmed">
                    管理数据导入导出，并查看应用信息。
                </Text>
            </Stack>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="sm">
                        <IconDatabase size={22} />
                        <Title order={4}>数据管理</Title>
                    </Group>
                    <Badge variant="light" color="blue">
                        {records.length} 条记录
                    </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                    导出或导入您的记录数据，支持新旧格式兼容
                </Text>

                <Group>
                    <Button
                        variant="outline"
                        leftSection={<IconDownload style={{ width: rem(16), height: rem(16) }} />}
                        onClick={HandleExport}
                    >
                        导出记录
                    </Button>
                    <Button
                        variant="outline"
                        leftSection={<IconUpload style={{ width: rem(16), height: rem(16) }} />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        导入记录
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={HandleFileChange}
                        style={{ display: "none" }}
                    />
                </Group>

                {importMessage !== null && (
                    <Notification
                        color="blue"
                        title="导入结果"
                        onClose={() => setImportMessage(null)}
                        withCloseButton
                        mt="md"
                    >
                        {importMessage}
                    </Notification>
                )}
            </Paper>

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group gap="sm" mb="xs">
                    <IconInfoCircle size={22} />
                    <Title order={4}>关于</Title>
                </Group>

                <Stack gap={4}>
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">应用名称</Text>
                        <Text size="sm" fw={500}>牛子小助手 (DickHelper)</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">版本</Text>
                        <Text size="sm" fw={500}>v2.0.0</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">技术栈</Text>
                        <Text size="sm" fw={500}>Electron + React + Mantine</Text>
                    </Group>
                </Stack>
            </Paper>
        </Stack>
    );
};
