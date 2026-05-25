import { useState, Component, type ReactNode } from "react";
import {
    AppShell,
    MantineProvider,
    NavLink,
    Title,
    Stack,
    ThemeIcon,
    Group,
    Divider,
    createTheme,
    Modal,
    Button,
    Text,
} from "@mantine/core";
import {
    IconClock,
    IconChartBar,
    IconHistory,
    IconSettings,
    IconDroplet,
    IconDownload,
    IconBolt,
    IconFingerprint,
} from "@tabler/icons-react";
import "@mantine/core/styles.css";
import { RecordForm } from "./views/RecordForm";
import { StatsChart } from "./views/StatsChart";
import { HistoryList } from "./views/HistoryList";
import { Settings } from "./views/Settings";
import { Prediction } from "./views/Prediction";
import { Fingerprint } from "./views/Fingerprint";
import { useUpdateState } from "./hooks/useUpdateState";
import { UpdateService } from "./services/UpdateService";

type View = "record" | "stats" | "history" | "prediction" | "fingerprint" | "settings";

interface IErrorBoundaryProps { children: ReactNode; }
interface IErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
    public constructor(props: IErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    public static getDerivedStateFromError(error: Error): IErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error("[ErrorBoundary]", error.message, info.componentStack);
    }

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{ maxWidth: 600, margin: "80px auto", padding: 32, fontFamily: "sans-serif" }}>
                    <h2 style={{ color: "#e03131" }}>应用错误 | App Error</h2>
                    <p>渲染进程发生未捕获错误。请查看 DevTools console 获取详情。</p>
                    <pre style={{
                        background: "#f1f3f5", padding: 16, borderRadius: 4,
                        whiteSpace: "pre-wrap", fontSize: 13
                    }}>
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: "8px 20px", background: "#228be6", color: "#fff",
                            border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14
                        }}
                    >
                        重新加载 | Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const theme = createTheme({
    fontFamily:
        "思源黑体, Noto Sans SC, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    defaultRadius: "md",
});

const NAV_ITEMS: { view: View; label: string; icon: typeof IconClock }[] = [
    { view: "record", label: "记录", icon: IconClock },
    { view: "stats", label: "统计", icon: IconChartBar },
    { view: "prediction", label: "预测", icon: IconBolt },
    { view: "fingerprint", label: "指纹", icon: IconFingerprint },
    { view: "history", label: "历史", icon: IconHistory },
];

export const App = () => {
    const [activeView, setActiveView] = useState<View>("record");
    const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(null);
    const { UpdateState } = useUpdateState();

    const updateVersion: string | null = UpdateState?.AvailableVersion ?? null;
    const shouldShowUpdateModal: boolean =
        UpdateState?.IsUpdateAvailable === true &&
        updateVersion !== null &&
        dismissedUpdateVersion !== updateVersion;

    const HandleDownloadUpdate = (): void => {
        void UpdateService.DownloadUpdate();
    };

    const HandleDismissUpdate = (): void => {
        setDismissedUpdateVersion(updateVersion);
    };

    return (
        <ErrorBoundary>
        <MantineProvider theme={theme}>
            <Modal
                opened={shouldShowUpdateModal}
                onClose={HandleDismissUpdate}
                title="发现新版本"
                centered
            >
                <Stack gap="md">
                    <Text size="sm">
                        当前版本 v{UpdateState?.CurrentVersion}，发现新版本 v{updateVersion}。
                    </Text>
                    <Text size="sm" c="dimmed">
                        是否现在下载更新？下载完成后可手动重启安装。
                    </Text>
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={HandleDismissUpdate}>
                            稍后
                        </Button>
                        <Button
                            leftSection={<IconDownload size={16} />}
                            onClick={HandleDownloadUpdate}
                        >
                            下载
                        </Button>
                    </Group>
                </Stack>
            </Modal>
            <AppShell
                navbar={{ width: 220, breakpoint: 0 }}
                padding="md"
            >
                <AppShell.Navbar p="md" style={{ display: "flex", flexDirection: "column" }}>
                    <Group gap="sm" pb="md" wrap="nowrap">
                        <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                            <IconDroplet size={20} />
                        </ThemeIcon>
                        <Title order={4} c="blue" style={{ whiteSpace: "nowrap" }}>
                            牛子小助手
                        </Title>
                    </Group>

                    <Divider />

                    <Stack gap={4} mt="md" style={{ flex: 1 }}>
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.view}
                                label={item.label}
                                leftSection={<item.icon size={20} />}
                                active={activeView === item.view}
                                onClick={() => setActiveView(item.view)}
                                variant="filled"
                                style={{ borderRadius: 8 }}
                            />
                        ))}
                    </Stack>

                    <Divider mb="xs" />

                    <NavLink
                        label="设置"
                        leftSection={<IconSettings size={20} />}
                        active={activeView === "settings"}
                        onClick={() => setActiveView("settings")}
                        variant="filled"
                        style={{ borderRadius: 8 }}
                    />
                </AppShell.Navbar>

                <AppShell.Main>
                    {activeView === "record" && <RecordForm />}
                    {activeView === "stats" && <StatsChart />}
                    {activeView === "prediction" && <Prediction />}
                    {activeView === "fingerprint" && <Fingerprint />}
                    {activeView === "history" && <HistoryList />}
                    {activeView === "settings" && <Settings />}
                </AppShell.Main>
            </AppShell>
        </MantineProvider>
        </ErrorBoundary>
    );
};
