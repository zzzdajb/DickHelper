import { Stack } from "expo-router";
import { useAppTheme } from "../../src/theme";

export default function SettingsLayout() {
    const theme = useAppTheme();

    return (
        <Stack
            screenOptions={{
                headerTitleAlign: "center",
                headerShadowVisible: false,
                headerStyle: {
                    backgroundColor: theme.colors.background,
                },
                contentStyle: {
                    backgroundColor: theme.colors.background,
                },
            }}
        >
            <Stack.Screen name="index" options={{ title: "设置" }} />
            <Stack.Screen name="ai" options={{ title: "AI 配置" }} />
        </Stack>
    );
}
