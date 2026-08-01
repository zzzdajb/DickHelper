import { Suspense, useMemo } from "react";
import { ActivityIndicator, StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { Stack } from "expo-router";
import { PaperProvider, Text } from "react-native-paper";
import { darkTheme, lightTheme, useAppTheme, type AppTheme } from "../src/theme";
import { InitializeDatabase } from "../src/services/MobileDatabaseService";
import { useMobileUpdateState } from "../src/hooks/useMobileUpdateState";
import { useTelemetry } from "../src/hooks/useTelemetry";

function AppLoadingScreen() {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);

    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="bodyMedium" style={styles.loadingText}>
                正在准备数据库
            </Text>
        </View>
    );
}

function MobileUpdateBootstrap() {
    useMobileUpdateState({
        autoCheckOnMount: true,
    });

    return null;
}

function TelemetryBootstrap() {
    useTelemetry();
    return null;
}

export default function RootLayout() {
    // GestureHandlerRootView 是 PaperProvider 的父级，取不到 useTheme，只能直接读系统深浅色
    const colorScheme = useColorScheme();
    const theme = colorScheme === "dark" ? darkTheme : lightTheme;
    const styles = useMemo(() => CreateStyles(theme), [theme]);

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <PaperProvider theme={theme}>
                    <StatusBar style="auto" />
                    <Suspense fallback={<AppLoadingScreen />}>
                        <SQLiteProvider databaseName="dickhelper.db" onInit={InitializeDatabase} useSuspense>
                            <MobileUpdateBootstrap />
                            <TelemetryBootstrap />
                            <Stack
                                screenOptions={{
                                    contentStyle: {
                                        backgroundColor: theme.colors.background,
                                    },
                                }}
                            >
                                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                <Stack.Screen name="settings" options={{ headerShown: false }} />
                            </Stack>
                        </SQLiteProvider>
                    </Suspense>
                </PaperProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

function CreateStyles(theme: AppTheme) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        loadingContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            backgroundColor: theme.colors.background,
        },
        loadingText: {
            color: theme.colors.onSurfaceVariant,
        },
    });
}
