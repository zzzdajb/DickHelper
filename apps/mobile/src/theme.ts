import { MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from "react-native-paper";

// MD3 没有「正文 / 辅助文字 / 成功」这三档色槽，扩展进主题让界面只有一个取色来源
export type AppTheme = MD3Theme & {
    colors: MD3Theme["colors"] & {
        textBody: string;
        textMuted: string;
        success: string;
    };
};

export const lightTheme: AppTheme = {
    ...MD3LightTheme,
    roundness: 6,
    colors: {
        ...MD3LightTheme.colors,
        primary: "#0f766e",
        secondary: "#2563eb",
        tertiary: "#d97706",
        background: "#f8fafc",
        surface: "#ffffff",
        surfaceVariant: "#e2e8f0",
        onSurface: "#0f172a",
        onSurfaceVariant: "#475569",
        outline: "#cbd5e1",
        error: "#dc2626",
        textBody: "#334155",
        textMuted: "#64748b",
        success: "#16a34a",
    },
};

// 深色是浅色 slate 色阶的镜像（900/700/600/500 → 100/200/300/400）
export const darkTheme: AppTheme = {
    ...MD3DarkTheme,
    roundness: 6,
    colors: {
        ...MD3DarkTheme.colors,
        primary: "#2dd4bf",
        secondary: "#60a5fa",
        tertiary: "#fbbf24",
        background: "#0f172a",
        surface: "#1e293b",
        surfaceVariant: "#334155",
        onSurface: "#f1f5f9",
        onSurfaceVariant: "#cbd5e1",
        outline: "#334155",
        error: "#f87171",
        textBody: "#e2e8f0",
        // slate-500 在 slate-800 卡片上只有约 3:1，低于可读阈值，三级文字改用 slate-400
        textMuted: "#94a3b8",
        success: "#4ade80",

        // 以下色槽没有对应的硬编码字面量，但必须覆盖：
        // MD3DarkTheme 继承来的值全部带紫调，而 Dialog / Snackbar / Divider / 实心按钮
        // 恰好都从这里取色，不覆盖就会出现「切到深色像另一个 App」的割裂感
        onPrimary: "#0f172a",
        onSecondary: "#0f172a",
        onTertiary: "#0f172a",
        onError: "#0f172a",
        onBackground: "#f1f5f9",
        // Divider 取 outlineVariant
        outlineVariant: "#334155",
        // Snackbar 在 MD3 里是反色的：深色模式下底浅字深
        inverseSurface: "#e2e8f0",
        inverseOnSurface: "#0f172a",
        inversePrimary: "#0f766e",
        // Dialog 遮罩
        backdrop: "rgba(15, 23, 42, 0.5)",
        // Dialog / Menu / 抬升的 Surface 取 elevation，需自底向上逐级变亮
        elevation: {
            level0: "transparent",
            level1: "#1e293b",
            level2: "#233042",
            level3: "#283748",
            level4: "#2b3b4d",
            level5: "#2f4053",
        },
    },
};

// Paper 的 useTheme 默认返回 MD3Theme，取不到上面三个自定义令牌，界面一律用这个
export function useAppTheme(): AppTheme {
    return useTheme<AppTheme>();
}
