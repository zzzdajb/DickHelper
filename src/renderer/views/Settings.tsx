import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Badge,
    Button,
    Divider,
    Group,
    Notification,
    Paper,
    PasswordInput,
    Progress,
    Select,
    SegmentedControl,
    Stack,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import {
    IconAlertCircle,
    IconBrain,
    IconDatabase,
    IconDownload,
    IconInfoCircle,
    IconRefresh,
    IconRocket,
    IconStar,
    IconUpload,
    IconWorld,
} from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { UpdateService } from "../services/UpdateService";
import { useRecords } from "../hooks/useRecords";
import { useUpdateState } from "../hooks/useUpdateState";
import type { UpdateSource, UpdateStatus } from "@dickhelper/shared";

const AI_PROVIDER_OPTIONS: { value: string; label: string }[] = [
    { value: "local", label: "本地规则分析" },
    { value: "openai", label: "OpenAI 兼容接口" },
];

const GetUpdateStatusText = (status: UpdateStatus | undefined): string => {
    switch (status) {
        case "checking":
            return "检查中";
        case "available":
            return "发现新版本";
        case "downloading":
            return "下载中";
        case "downloaded":
            return "已下载";
        case "not-available":
            return "已是最新";
        case "error":
            return "检查失败";
        case "disabled":
            return "开发模式";
        default:
            return "空闲";
    }
};

const GetUpdateSourceValue = (value: string): UpdateSource => {
    if (value === "github") {
        return "github";
    }

    return "mirror";
};

export const Settings = () => {
    const { records, refresh } = useRecords();
    const { UpdateState } = useUpdateState();
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateSource: UpdateSource = UpdateState?.Source ?? "mirror";
    const currentVersion: string = UpdateState?.CurrentVersion ?? "2.0.0";
    const updateStatusText: string = GetUpdateStatusText(UpdateState?.Status);
    const updateProgress: number = UpdateState?.DownloadProgress ?? 0;
    const isChecking: boolean = UpdateState?.IsChecking === true;
    const isDownloading: boolean = UpdateState?.IsDownloading === true;

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

    const HandleSourceChange = (value: string): void => {
        void UpdateService.SetSource(GetUpdateSourceValue(value));
    };

    const HandleCheckUpdate = (): void => {
        void UpdateService.CheckForUpdates();
    };

    const HandleDownloadUpdate = (): void => {
        void UpdateService.DownloadUpdate();
    };

    const HandleInstallUpdate = (): void => {
        void UpdateService.InstallUpdate();
    };

    return (
        <Stack gap="lg" maw={760} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">
                    设置
                </Title>
                <Text size="sm" c="dimmed">
                    管理数据导入导出、AI 分析配置，并查看应用信息。
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
                    导出或导入您的记录数据，支持新旧格式兼容。
                </Text>

                <Group>
                    <Button variant="outline" leftSection={<IconDownload size={16} />} onClick={HandleExport}>
                        导出记录
                    </Button>
                    <Button variant="outline" leftSection={<IconUpload size={16} />} onClick={() => fileInputRef.current?.click()}>
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

            <AiConfigSection />

            <Paper shadow="sm" radius="md" p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="sm">
                        <IconWorld size={22} />
                        <Title order={4}>应用更新</Title>
                    </Group>
                    <Badge
                        variant="light"
                        color={UpdateState?.Status === "error" ? "red" : "blue"}
                    >
                        {updateStatusText}
                    </Badge>
                </Group>

                <Text size="sm" c="dimmed" mb="md">
                    启动时自动检查更新，发现新版本后由您决定是否下载。
                </Text>

                <Stack gap="md">
                    <Group justify="space-between" align="center">
                        <Text size="sm" c="dimmed">更新源</Text>
                        <SegmentedControl
                            value={updateSource}
                            onChange={(value) => {
                                HandleSourceChange(value);
                            }}
                            data={[
                                { label: "ghfast 镜像", value: "mirror" },
                                { label: "GitHub 直连", value: "github" },
                            ]}
                        />
                    </Group>

                    <Divider />

                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">当前版本</Text>
                        <Text size="sm" fw={500}>v{currentVersion}</Text>
                    </Group>

                    {UpdateState?.AvailableVersion !== null && UpdateState?.AvailableVersion !== undefined && (
                        <>
                            <Divider />
                            <Group justify="space-between">
                                <Text size="sm" c="dimmed">可用版本</Text>
                                <Text size="sm" fw={500}>v{UpdateState.AvailableVersion}</Text>
                            </Group>
                        </>
                    )}

                    {isDownloading && (
                        <Progress value={updateProgress} animated />
                    )}

                    {UpdateState?.ErrorMessage !== null && UpdateState?.ErrorMessage !== undefined && (
                        <Alert
                            color="red"
                            icon={<IconAlertCircle size={18} />}
                            title="更新失败"
                        >
                            {UpdateState.ErrorMessage}
                        </Alert>
                    )}

                    <Group>
                        <Button
                            variant="outline"
                            leftSection={<IconRefresh size={16} />}
                            onClick={HandleCheckUpdate}
                            loading={isChecking}
                            disabled={isDownloading}
                        >
                            检查更新
                        </Button>

                        {UpdateState?.IsUpdateAvailable === true && (
                            <Button
                                leftSection={<IconDownload size={16} />}
                                onClick={HandleDownloadUpdate}
                                loading={isDownloading}
                            >
                                下载更新
                            </Button>
                        )}

                        {UpdateState?.IsUpdateDownloaded === true && (
                            <Button
                                color="green"
                                leftSection={<IconRocket size={16} />}
                                onClick={HandleInstallUpdate}
                            >
                                重启安装
                            </Button>
                        )}
                    </Group>
                </Stack>
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
                        <Text size="sm" fw={500}>v{currentVersion}</Text>
                    </Group>
                    <Divider />
                    <Button
                        variant="light"
                        color="yellow"
                        fullWidth
                        leftSection={<IconStar size={16} />}
                        onClick={() => { void window.electronAPI.OpenExternal("https://github.com/zzzdajb/DickHelper"); }}
                    >
                        喜欢这个应用？去 GitHub 给项目点个 Star
                    </Button>
                </Stack>
            </Paper>
        </Stack>
    );
};

const AiConfigSection = () => {
    const [provider, setProvider] = useState<string>("local");
    const [apiEndpoint, setApiEndpoint] = useState<string>("https://api.openai.com/v1/chat/completions");
    const [apiKey, setApiKey] = useState<string>("");
    const [model, setModel] = useState<string>("gpt-4o-mini");
    const [saved, setSaved] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const LoadSettings = async (): Promise<void> => {
            const [providerSetting, endpointSetting, apiKeySetting, modelSetting] = await Promise.all([
                DatabaseService.GetSetting("ai_provider"),
                DatabaseService.GetSetting("ai_api_endpoint"),
                DatabaseService.GetSetting("ai_api_key"),
                DatabaseService.GetSetting("ai_model"),
            ]);

            setProvider(providerSetting === "openai" ? "openai" : "local");
            if (endpointSetting !== null) {
                setApiEndpoint(endpointSetting);
            }
            if (apiKeySetting !== null) {
                setApiKey(apiKeySetting);
            }
            if (modelSetting !== null) {
                setModel(modelSetting);
            }
        };

        void LoadSettings();
        return () => {
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
        };
    }, []);

    const HandleSave = async (): Promise<void> => {
        try {
            await DatabaseService.SetSetting("ai_provider", provider);
            await DatabaseService.SetSetting("ai_api_endpoint", apiEndpoint);
            await DatabaseService.SetSetting("ai_api_key", apiKey);
            await DatabaseService.SetSetting("ai_model", model);
            setSaveError(null);
            setSaved(true);
            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
            }
            savedTimerRef.current = setTimeout(() => {
                setSaved(false);
            }, 2000);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setSaved(false);
            setSaveError(message);
        }
    };

    const showApiFields: boolean = provider === "openai";

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group gap="sm" mb="xs">
                <IconBrain size={22} />
                <Title order={4}>AI 分析配置</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                本地规则分析是默认选项，不需要 API。切换到 OpenAI 兼容接口后可以配置地址、密钥和模型。
            </Text>

            <Stack gap="sm">
                <Select
                    label="分析方式"
                    data={AI_PROVIDER_OPTIONS}
                    value={provider}
                    onChange={(value) => {
                        setProvider(value ?? "local");
                    }}
                />

                {showApiFields && (
                    <>
                        <TextInput
                            label="API 地址"
                            description="支持本地 HTTP 地址或任何 OpenAI Chat Completions 兼容端点。"
                            placeholder="https://api.openai.com/v1/chat/completions"
                            value={apiEndpoint}
                            onChange={(e) => setApiEndpoint(e.currentTarget.value)}
                        />
                        <PasswordInput
                            label="API Key"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.currentTarget.value)}
                        />
                        <TextInput
                            label="模型名称"
                            placeholder="gpt-4o-mini"
                            value={model}
                            onChange={(e) => setModel(e.currentTarget.value)}
                        />
                    </>
                )}

                <Group align="center">
                    <Button variant="filled" color="blue" onClick={HandleSave}>
                        保存配置
                    </Button>
                    {saved && (
                        <Text size="sm" c="green">
                            已保存
                        </Text>
                    )}
                </Group>

                {saveError !== null && (
                    <Alert color="red" icon={<IconAlertCircle size={18} />} title="保存失败">
                        {saveError}
                    </Alert>
                )}
            </Stack>
        </Paper>
    );
};
