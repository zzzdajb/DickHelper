import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Snackbar, Surface, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { useAppTheme, type AppTheme } from "../../src/theme";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";

const AI_PROVIDER_KEY = "ai_provider";
const AI_API_ENDPOINT_KEY = "ai_api_endpoint";
const AI_API_KEY_KEY = "ai_api_key";
const AI_MODEL_KEY = "ai_model";

const DEFAULT_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export default function AiSettingsScreen() {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);
    const database = useMobileDatabaseService();
    const [provider, setProvider] = useState<"local" | "openai">("local");
    const [apiEndpoint, setApiEndpoint] = useState<string>(DEFAULT_API_ENDPOINT);
    const [apiKey, setApiKey] = useState<string>("");
    const [model, setModel] = useState<string>(DEFAULT_MODEL);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string | null>(null);

    const LoadSettings = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const savedProvider = await database.GetSetting(AI_PROVIDER_KEY);
            const savedEndpoint = await database.GetSetting(AI_API_ENDPOINT_KEY);
            const savedKey = await database.GetSetting(AI_API_KEY_KEY);
            const savedModel = await database.GetSetting(AI_MODEL_KEY);

            setProvider(savedProvider === "openai" ? "openai" : "local");
            setApiEndpoint(savedEndpoint ?? DEFAULT_API_ENDPOINT);
            setApiKey(savedKey ?? "");
            setModel(savedModel ?? DEFAULT_MODEL);
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`加载设置失败：${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }, [database]);

    useFocusEffect(
        useCallback(() => {
            void LoadSettings();
        }, [LoadSettings])
    );

    const HandleSave = async (): Promise<void> => {
        setSaving(true);
        try {
            await database.SetSetting(AI_PROVIDER_KEY, provider);
            await database.SetSetting(AI_API_ENDPOINT_KEY, apiEndpoint.trim());
            await database.SetSetting(AI_API_KEY_KEY, apiKey.trim());
            await database.SetSetting(AI_MODEL_KEY, model.trim());
            setMessage("AI 设置已保存");
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`保存失败：${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    AI 配置
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    选择分析方式并配置 AI 参数
                </Text>
            </View>

            {loading ? (
                <Text variant="bodyMedium" style={styles.stateText}>
                    正在加载设置...
                </Text>
            ) : (
                <>
                    <Surface style={styles.sectionSurface} elevation={1}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            分析方式
                        </Text>
                        <SegmentedButtons
                            value={provider}
                            onValueChange={(value) => setProvider(value as "local" | "openai")}
                            buttons={[
                                { value: "local", label: "本地分析" },
                                { value: "openai", label: "OpenAI API" },
                            ]}
                            style={styles.segmentedButtons}
                        />
                    </Surface>

                    {provider === "openai" ? (
                        <Surface style={styles.sectionSurface} elevation={1}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                API 配置
                            </Text>
                            <TextInput
                                label="API 地址"
                                value={apiEndpoint}
                                onChangeText={setApiEndpoint}
                                mode="outlined"
                                placeholder={DEFAULT_API_ENDPOINT}
                                disabled={saving}
                                style={styles.textInput}
                            />
                            <TextInput
                                label="API Key"
                                value={apiKey}
                                onChangeText={setApiKey}
                                mode="outlined"
                                secureTextEntry
                                placeholder="sk-..."
                                disabled={saving}
                                style={styles.textInput}
                            />
                            <TextInput
                                label="模型名称"
                                value={model}
                                onChangeText={setModel}
                                mode="outlined"
                                placeholder={DEFAULT_MODEL}
                                disabled={saving}
                                style={styles.textInput}
                            />
                        </Surface>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={() => {
                            void HandleSave();
                        }}
                        loading={saving}
                        disabled={saving || loading}
                        style={styles.saveButton}
                    >
                        保存设置
                    </Button>
                </>
            )}

            <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3200}>
                {message}
            </Snackbar>
        </ScrollView>
    );
}

// 样式表吃进主题算出来，颜色才能跟随深浅色切换，同时仍集中在文件底部一处
function CreateStyles(theme: AppTheme) {
    return StyleSheet.create({
        scrollContent: {
            flexGrow: 1,
            padding: 16,
            gap: 16,
        },
        header: {
            gap: 8,
        },
        title: {
            color: theme.colors.primary,
            fontWeight: "700",
        },
        subtitle: {
            color: theme.colors.onSurfaceVariant,
        },
        stateText: {
            color: theme.colors.textMuted,
        },
        sectionSurface: {
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            padding: 16,
            gap: 12,
        },
        sectionTitle: {
            color: theme.colors.onSurface,
            fontWeight: "700",
        },
        segmentedButtons: {
            marginTop: 4,
        },
        textInput: {
            backgroundColor: theme.colors.surface,
        },
        saveButton: {
            borderRadius: 12,
        },
    });
}
