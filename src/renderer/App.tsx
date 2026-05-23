import { useState } from "react";
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
    );
};
