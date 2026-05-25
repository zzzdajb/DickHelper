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
    Select,
    TextInput,
    PasswordInput,
} from "@mantine/core";
import { IconDownload, IconUpload, IconDatabase, IconInfoCircle, IconUsers, IconBrain } from "@tabler/icons-react";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";

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

            <AiConfigSection />

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

const PROVIDER_OPTIONS: { value: string; label: string }[] = [
    { value: "local", label: "本地规则分析（无需 API）" },
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "openai", label: "OpenAI (GPT)" },
    { value: "google", label: "Google (Gemini)" },
    { value: "ollama", label: "Ollama（本地模型）" },
    { value: "cli", label: "本地 CLI 命令" },
];

const AiConfigSection = () => {
    const [provider, setProvider] = useState<string>("local");
    const [apiKey, setApiKey] = useState<string>("");
    const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");
    const [ollamaModel, setOllamaModel] = useState<string>("llama3");
    const [googleModel, setGoogleModel] = useState<string>("gemini-2.0-flash");
    const [cliCommand, setCliCommand] = useState<string>("claude -p");
    const [saved, setSaved] = useState<boolean>(false);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        DatabaseService.GetSetting("ai_provider").then((v) => { if (v !== null) setProvider(v); });
        DatabaseService.GetSetting("ai_api_key").then((v) => { if (v !== null) setApiKey(v); });
        DatabaseService.GetSetting("ai_ollama_url").then((v) => { if (v !== null) setOllamaUrl(v); });
        DatabaseService.GetSetting("ai_ollama_model").then((v) => { if (v !== null) setOllamaModel(v); });
        DatabaseService.GetSetting("ai_google_model").then((v) => { if (v !== null) setGoogleModel(v); });
        DatabaseService.GetSetting("ai_cli_command").then((v) => { if (v !== null) setCliCommand(v); });
        return () => {
            if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
        };
    }, []);

    const HandleSave = async (): Promise<void> => {
        await DatabaseService.SetSetting("ai_provider", provider);
        await DatabaseService.SetSetting("ai_api_key", apiKey);
        await DatabaseService.SetSetting("ai_ollama_url", ollamaUrl);
        await DatabaseService.SetSetting("ai_ollama_model", ollamaModel);
        await DatabaseService.SetSetting("ai_google_model", googleModel);
        await DatabaseService.SetSetting("ai_cli_command", cliCommand);
        setSaved(true);
        if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    };

    const showApiKey: boolean = provider === "anthropic" || provider === "openai" || provider === "google";
    const showOllama: boolean = provider === "ollama";
    const showGoogle: boolean = provider === "google";
    const showCli: boolean = provider === "cli";

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Group gap="sm" mb="xs">
                <IconBrain size={22} />
                <Title order={4}>AI 分析配置</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                选择 AI 服务商用于数据分析，支持云端 API、本地模型和 CLI 工具。
            </Text>

            <Stack gap="sm">
                <Select
                    label="AI 服务商"
                    data={PROVIDER_OPTIONS}
                    value={provider}
                    onChange={(v) => { if (v !== null) setProvider(v); }}
                />

                {showApiKey && (
                    <PasswordInput
                        label="API Key"
                        placeholder={provider === "anthropic" ? "sk-ant-..." : provider === "google" ? "AIza..." : "sk-..."}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.currentTarget.value)}
                    />
                )}

                {showGoogle && (
                    <TextInput
                        label="模型名称"
                        placeholder="gemini-2.0-flash"
                        value={googleModel}
                        onChange={(e) => setGoogleModel(e.currentTarget.value)}
                    />
                )}

                {showOllama && (
                    <>
                        <TextInput
                            label="Ollama 地址"
                            placeholder="http://localhost:11434"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.currentTarget.value)}
                        />
                        <TextInput
                            label="模型名称"
                            placeholder="llama3"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.currentTarget.value)}
                        />
                    </>
                )}

                {showCli && (
                    <TextInput
                        label="CLI 命令"
                        description="提示词将通过 stdin 传入，stdout 作为分析结果。例如：claude -p"
                        placeholder="claude -p"
                        value={cliCommand}
                        onChange={(e) => setCliCommand(e.currentTarget.value)}
                    />
                )}

                <Group>
                    <Button variant="filled" color="blue" onClick={HandleSave}>
                        保存配置
                    </Button>
                    {saved && (
                        <Text size="sm" c="green">已保存</Text>
                    )}
                </Group>
            </Stack>
        </Paper>
    );
};
