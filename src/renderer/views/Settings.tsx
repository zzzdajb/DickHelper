import { useState, useRef, useEffect } from "react";
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
    Switch,
    Progress,
    Anchor,
    Loader,
} from "@mantine/core";
import { IconDownload, IconUpload, IconDatabase, IconInfoCircle, IconUsers, IconRefresh, IconBrandGithub } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";
import type { IUpdateStatus } from "../types/IRecord";

const GITHUB_URL: string = "https://github.com/zzzdajb/DickHelper";

export const Settings = () => {
    const { records, refresh } = useRecords();
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [communityOptIn, setCommunityOptIn] = useState<boolean>(false);
    const [configLoaded, setConfigLoaded] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        DatabaseService.GetConfig().then((config) => {
            setCommunityOptIn(config.CommunityOptIn);
            setConfigLoaded(true);
        });
    }, []);

    const HandleOptInToggle = async (checked: boolean): Promise<void> => {
        setCommunityOptIn(checked);
        await DatabaseService.SetConfig({ CommunityOptIn: checked });
    };

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
                <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="sm">
                        <IconUsers size={22} />
                        <Title order={4}>社区统计</Title>
                    </Group>
                    {configLoaded && (
                        <Switch
                            checked={communityOptIn}
                            onChange={(e) => HandleOptInToggle(e.currentTarget.checked)}
                            size="md"
                        />
                    )}
                </Group>
                <Text size="sm" c="dimmed" mb="xs">
                    匿名参与社区聚合统计，查看你和社区平均水平的对比。
                </Text>
                <Text size="xs" c="dimmed">
                    开启后仅上报本周次数和平均时长两个数字，不含任何个人信息、时间戳或记录详情。
                    数据通过随机 ID 匿名提交，无法关联到你的身份。可随时关闭。
                </Text>
            </Paper>

            <UpdateSection />

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
                        <Text size="sm" c="dimmed">技术栈</Text>
                        <Text size="sm" fw={500}>Electron + React + Mantine</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">GitHub</Text>
                        <Anchor
                            size="sm"
                            fw={500}
                            onClick={() => DatabaseService.OpenExternal(GITHUB_URL)}
                            style={{ cursor: "pointer" }}
                        >
                            zzzdajb/DickHelper
                        </Anchor>
                    </Group>
                </Stack>
            </Paper>
        </Stack>
    );
};

const UpdateSection = () => {
    const [status, setStatus] = useState<IUpdateStatus>({ Status: "idle" });
    const [version, setVersion] = useState<string>("...");
    const [useMirror, setUseMirror] = useState<boolean>(false);
    const [settingLoaded, setSettingLoaded] = useState<boolean>(false);

    useEffect(() => {
        DatabaseService.GetAppVersion().then((v) => setVersion(v));
        DatabaseService.GetSetting("update_use_mirror").then((v) => {
            setUseMirror(v === "true");
            setSettingLoaded(true);
        });
        const cleanup: () => void = DatabaseService.OnUpdateStatus((s) => setStatus(s));
        return cleanup;
    }, []);

    const HandleCheckUpdate = async (): Promise<void> => {
        try {
            await DatabaseService.CheckForUpdates(useMirror);
        } catch {
            // 错误通过 OnUpdateStatus 事件处理
        }
    };

    const HandleDownloadUpdate = async (): Promise<void> => {
        try {
            await DatabaseService.DownloadUpdate();
        } catch {
            // 错误通过 OnUpdateStatus 事件处理
        }
    };

    const HandleInstallUpdate = (): void => {
        DatabaseService.InstallUpdate();
    };

    const HandleMirrorToggle = async (checked: boolean): Promise<void> => {
        setUseMirror(checked);
        await DatabaseService.SetSetting("update_use_mirror", checked ? "true" : "false");
    };

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group gap="sm" mb="xs">
                <IconRefresh size={22} />
                <Title order={4}>软件更新</Title>
            </Group>

            <Stack gap="sm">
                <Group justify="space-between">
                    <Text size="sm" c="dimmed">当前版本</Text>
                    <Badge variant="light" color="blue">v{version}</Badge>
                </Group>

                {settingLoaded && (
                    <Switch
                        label="使用镜像加速（大陆用户）"
                        checked={useMirror}
                        onChange={(e) => HandleMirrorToggle(e.currentTarget.checked)}
                        size="sm"
                    />
                )}

                {status.Status === "idle" && (
                    <Button variant="light" leftSection={<IconRefresh style={{ width: rem(16), height: rem(16) }} />} onClick={HandleCheckUpdate}>
                        检查更新
                    </Button>
                )}

                {status.Status === "checking" && (
                    <Group gap="xs">
                        <Loader size="xs" />
                        <Text size="sm" c="dimmed">正在检查更新...</Text>
                    </Group>
                )}

                {status.Status === "not-available" && (
                    <Group justify="space-between">
                        <Text size="sm" c="green">已是最新版本</Text>
                        <Button variant="subtle" size="xs" onClick={() => setStatus({ Status: "idle" })}>
                            重新检查
                        </Button>
                    </Group>
                )}

                {status.Status === "available" && (
                    <Stack gap="xs">
                        <Text size="sm">
                            发现新版本：<Badge color="blue" variant="filled">v{status.Version}</Badge>
                        </Text>
                        <Group>
                            <Button variant="filled" color="blue" onClick={HandleDownloadUpdate}>
                                下载更新
                            </Button>
                            <Button
                                variant="subtle"
                                size="sm"
                                leftSection={<IconBrandGithub style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => DatabaseService.OpenExternal(`${GITHUB_URL}/releases/latest`)}
                            >
                                手动下载
                            </Button>
                        </Group>
                    </Stack>
                )}

                {status.Status === "downloading" && (
                    <Stack gap="xs">
                        <Text size="sm" c="dimmed">正在下载更新... {status.Progress ?? 0}%</Text>
                        <Progress value={status.Progress ?? 0} animated />
                    </Stack>
                )}

                {status.Status === "downloaded" && (
                    <Stack gap="xs">
                        <Text size="sm" c="green">
                            更新已下载完成（v{status.Version}）
                        </Text>
                        <Button variant="filled" color="green" onClick={HandleInstallUpdate}>
                            安装并重启
                        </Button>
                    </Stack>
                )}

                {status.Status === "error" && (
                    <Stack gap="xs">
                        <Text size="sm" c="red">更新失败：{status.Error}</Text>
                        <Group>
                            <Button variant="light" onClick={HandleCheckUpdate}>
                                重试
                            </Button>
                            <Button
                                variant="subtle"
                                leftSection={<IconBrandGithub style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => DatabaseService.OpenExternal(`${GITHUB_URL}/releases/latest`)}
                            >
                                手动下载
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};
