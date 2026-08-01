import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
        "**/node_modules/**",
        "**/out/**",
        "**/dist/**",
        "**/.expo/**",
        "**/android/**",
        "**/ios/**",
        "apps/mobile/babel.config.js",
    ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "no-undef": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        // 移动端支持深色模式，颜色必须来自主题才能跟随系统切换。
        // 硬编码色值是合法字符串，typecheck 和测试都拦不住，只有这条规则能拦。
        // 唯一的例外是 src/theme.ts —— 色值的唯一归属地。
        files: ["apps/mobile/**/*.{ts,tsx}"],
        ignores: ["apps/mobile/src/theme.ts"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
                    message: "移动端禁止硬编码颜色值。请改用 useAppTheme() 取主题令牌；新色值只能加在 apps/mobile/src/theme.ts。",
                },
            ],
        },
    }
);
