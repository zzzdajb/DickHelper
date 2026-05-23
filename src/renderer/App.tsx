import { useState, Component, type ReactNode } from "react";
import {
    AppShell,
    MantineProvider,
    NavLink,
    Title,
    Stack,
    createTheme,
} from "@mantine/core";
import {
    IconClock,
    IconChartBar,
    IconHistory,
    IconSettings,
} from "@tabler/icons-react";
import "@mantine/core/styles.css";
import { RecordForm } from "./views/RecordForm";
import { StatsChart } from "./views/StatsChart";
import { HistoryList } from "./views/HistoryList";
import { Settings } from "./views/Settings";

type View = "record" | "stats" | "history" | "settings";

// 错误边界：捕获渲染进程中的 React 错误，避免白屏
// 使用纯 HTML 元素（不能用 Mantine 组件），因为它包裹在 MantineProvider 之外
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
    primaryColor: "blue",
    fontFamily:
        "思源黑体, Noto Sans SC, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    defaultRadius: "md",
});

/**
 * 应用根组件
 * MantineProvider + AppShell 布局，左右分栏
 * 左侧 200px 导航栏，4 个导航项；右侧条件渲染单视图
 */
export const App = () => {
    const [activeView, setActiveView] = useState<View>("record");

    return (
        <ErrorBoundary>
        <MantineProvider theme={theme}>
            <AppShell
                navbar={{ width: 200, breakpoint: 0 }}
                padding="md"
            >
                <AppShell.Navbar p="md">
                    <Stack gap="xs">
                        <Title order={4} ta="center" c="blue" mb="md">
                            牛子小助手
                        </Title>

                        <NavLink
                            label="记录"
                            leftSection={<IconClock size={20} />}
                            active={activeView === "record"}
                            onClick={() => setActiveView("record")}
                            variant="filled"
                            style={{ borderRadius: 8 }}
                        />
                        <NavLink
                            label="统计"
                            leftSection={<IconChartBar size={20} />}
                            active={activeView === "stats"}
                            onClick={() => setActiveView("stats")}
                            variant="filled"
                            style={{ borderRadius: 8 }}
                        />
                        <NavLink
                            label="历史"
                            leftSection={<IconHistory size={20} />}
                            active={activeView === "history"}
                            onClick={() => setActiveView("history")}
                            variant="filled"
                            style={{ borderRadius: 8 }}
                        />
                        <NavLink
                            label="设置"
                            leftSection={<IconSettings size={20} />}
                            active={activeView === "settings"}
                            onClick={() => setActiveView("settings")}
                            variant="filled"
                            style={{ borderRadius: 8 }}
                        />
                    </Stack>
                </AppShell.Navbar>

                <AppShell.Main>
                    {activeView === "record" && <RecordForm />}
                    {activeView === "stats" && <StatsChart />}
                    {activeView === "history" && <HistoryList />}
                    {activeView === "settings" && <Settings />}
                </AppShell.Main>
            </AppShell>
        </MantineProvider>
        </ErrorBoundary>
    );
};
