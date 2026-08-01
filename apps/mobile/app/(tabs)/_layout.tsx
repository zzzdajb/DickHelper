import { useRouter, Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { IconButton } from "react-native-paper";
import { useAppTheme } from "../../src/theme";

function SettingsButton() {
    const router = useRouter();
    const theme = useAppTheme();

    return (
        <IconButton
            icon="cog-outline"
            onPress={() => router.push("/settings")}
            iconColor={theme.colors.onSurface}
            accessibilityLabel="打开设置"
        />
    );
}

export default function TabsLayout() {
    const theme = useAppTheme();

    return (
        <Tabs
            screenOptions={{
                headerTitleAlign: "center",
                headerShadowVisible: false,
                headerStyle: {
                    backgroundColor: theme.colors.background,
                },
                headerRight: () => <SettingsButton />,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.outline,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "记录",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="timer-outline" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="stats"
                options={{
                    title: "统计",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="chart-box-outline" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="prediction"
                options={{
                    title: "预测",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="lightbulb-outline" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: "历史",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="history" color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}
