import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, List, Portal, ProgressBar, SegmentedButtons, Snackbar, Surface, Switch, Text, TextInput } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import type { IMobileUpdateState, MobileUpdateStatus } from "../../src/types/MobileUpdate";
import { useAppTheme, type AppTheme } from "../../src/theme";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";
import { useMobileUpdateState } from "../../src/hooks/useMobileUpdateState";
import { useRecords } from "../../src/hooks/useRecords";
import { useTelemetry } from "../../src/hooks/useTelemetry";
import { FormatDateTime } from "../../src/utils/formatters";
import { SyncWithDesktop } from "../../src/services/MobileSyncService";

export default function SettingsScreen() {
    const theme = useAppTheme();
    const styles = useMemo(() => CreateStyles(theme), [theme]);
    const router = useRouter();
    const database = useMobileDatabaseService();
    const { records, refresh } = useRecords();
    const { updateState, setUpdateSource, checkForUpdates, downloadUpdate, installUpdate, openInstallPermissionSettings } =
        useMobileUpdateState();
    const { enabled: telemetryEnabled, toggle: telemetryToggle, osLabel, appVersion, debugInfo } = useTelemetry();
    const [telemetryConfirmVisible, setTelemetryConfirmVisible] = useState<boolean>(false);
    const [telemetryDebugVisible, setTelemetryDebugVisible] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string | null>(null);
    const [syncAddress, setSyncAddress] = useState<string>("");
    const [syncPort, setSyncPort] = useState<string>("9527");
    const [syncing, setSyncing] = useState<boolean>(false);
    const [syncDialogVisible, setSyncDialogVisible] = useState<boolean>(false);
    const [syncDialogSuccess, setSyncDialogSuccess] = useState<boolean>(true);
    const [syncDialogContent, setSyncDialogContent] = useState<string>("");

    const isUpdateActionBusy = updateState.IsChecking || updateState.IsDownloading || updateState.IsInstalling;
    const hasUpdateDetails = updateState.AvailableVersion !== null;
    const sourceLabel = updateState.Source === "github" ? "GitHub" : "镜像";
    const downloadButtonLabel = updateState.Status === "error" && hasUpdateDetails ? "重新下载 APK" : "下载 APK";
    const statusText = GetUpdateStatusText(updateState.Status);

    const HandleImport = async (): Promise<void> => {
        setBusy(true);
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/json", "text/json", "text/plain", "*/*"],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) {
                return;
            }

            const asset = result.assets[0];
            if (asset === undefined) {
                setMessage("未选择文件");
                return;
            }

            const jsonText = await FileSystem.readAsStringAsync(asset.uri);
            const importResult = await database.ImportFromJson(jsonText);
            await refresh();
            setMessage(
                `导入完成：成功 ${importResult.Imported} 条，跳过 ${importResult.Skipped} 条，拒绝 ${importResult.Rejected} 条`
            );
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`导入失败：${errorMessage}`);
        } finally {
            setBusy(false);
        }
    };

    const HandleExport = async (): Promise<void> => {
        setBusy(true);
        try {
            const jsonText = await database.ExportToJson();
            const cacheDirectory = FileSystem.cacheDirectory;
            if (cacheDirectory === null) {
                setMessage("当前设备无法导出文件");
                return;
            }

            const fileUri = `${cacheDirectory}dickhelper-export.json`;
            await FileSystem.writeAsStringAsync(fileUri, jsonText);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
                setMessage(`已导出 ${records.length} 条记录`);
            } else {
                setMessage("当前设备不支持分享导出");
            }
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`导出失败：${errorMessage}`);
        } finally {
            setBusy(false);
        }
    };

    const HandleUpdateSourceChange = async (value: string): Promise<void> => {
        const nextSource = value === "github" ? "github" : "mirror";
        try {
            const nextState = await setUpdateSource(nextSource);
            setMessage(`更新源已切换到 ${nextState.Source === "github" ? "GitHub" : "镜像"}`);
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`切换更新源失败：${errorMessage}`);
        }
    };

    const HandleCheckUpdates = async (): Promise<void> => {
        try {
            const nextState = await checkForUpdates();
            setMessage(BuildUpdateResultMessage(nextState));
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`检查更新失败：${errorMessage}`);
        }
    };

    const HandleDownloadUpdate = async (): Promise<void> => {
        try {
            const nextState = await downloadUpdate();
            setMessage(BuildUpdateResultMessage(nextState));
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`下载更新失败：${errorMessage}`);
        }
    };

    const HandleInstallUpdate = async (): Promise<void> => {
        try {
            const nextState = await installUpdate();
            setMessage(BuildUpdateResultMessage(nextState));
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`安装更新失败：${errorMessage}`);
        }
    };

    const HandleOpenInstallPermissions = async (): Promise<void> => {
        try {
            await openInstallPermissionSettings();
            setMessage("已打开系统安装权限设置");
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setMessage(`打开安装权限设置失败：${errorMessage}`);
        }
    };

    const HandleTelemetryToggle = (nextValue: boolean): void => {
        if (nextValue) {
            void telemetryToggle(true);
        } else {
            setTelemetryConfirmVisible(true);
        }
    };

    const HandleConfirmTelemetryDisable = (): void => {
        setTelemetryConfirmVisible(false);
        void telemetryToggle(false);
    };

    const HandleSync = async (): Promise<void> => {
        const trimmedAddress = syncAddress.trim();
        if (trimmedAddress.length === 0) {
            setMessage("请输入桌面端 IP 地址");
            return;
        }

        const parsedPort = parseInt(syncPort, 10);
        if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
            setMessage("端口号无效，请输入 1-65535 之间的数字");
            return;
        }

        setSyncing(true);
        try {
            const result = await SyncWithDesktop(trimmedAddress, parsedPort, database);
            await refresh();
            setSyncDialogSuccess(true);
            setSyncDialogContent(`导入 ${result.Imported} 条，跳过 ${result.Skipped} 条，拒绝 ${result.Rejected} 条`);
            setSyncDialogVisible(true);
        } catch (caught: unknown) {
            const errorMessage = caught instanceof Error ? caught.message : String(caught);
            setSyncDialogSuccess(false);
            setSyncDialogContent(errorMessage);
            setSyncDialogVisible(true);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text variant="headlineSmall" style={styles.title}>
                    设置
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    导入、导出、更新和关于信息。
                </Text>
            </View>

            <Surface style={styles.sectionSurface} elevation={1}>
                <List.Section>
                    <List.Subheader>数据</List.Subheader>
                    <List.Item
                        title="导入 JSON"
                        description="支持 canonical v1 与旧版数组格式"
                        left={(props) => <List.Icon {...props} icon="download" />}
                        onPress={() => {
                            void HandleImport();
                        }}
                        disabled={busy}
                    />
                    <List.Item
                        title="导出 JSON"
                        description="导出 canonical v1 格式"
                        left={(props) => <List.Icon {...props} icon="upload" />}
                        onPress={() => {
                            void HandleExport();
                        }}
                        disabled={busy}
                    />
                </List.Section>
            </Surface>

            <Surface style={styles.sectionSurface} elevation={1}>
                <View style={styles.updateHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        局域网同步
                    </Text>
                    <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                        连接桌面端进行数据同步，需先在桌面端启动同步服务。
                    </Text>
                </View>

                <TextInput
                    label="桌面端 IP 地址"
                    placeholder="192.168.1.100"
                    value={syncAddress}
                    onChangeText={setSyncAddress}
                    disabled={busy || syncing}
                    mode="outlined"
                    style={styles.textInput}
                />

                <TextInput
                    label="端口号"
                    placeholder="9527"
                    value={syncPort}
                    onChangeText={setSyncPort}
                    disabled={busy || syncing}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.textInput}
                />

                <Button
                    mode="contained"
                    icon="sync"
                    onPress={() => {
                        void HandleSync();
                    }}
                    loading={syncing}
                    disabled={busy || syncing || syncAddress.trim().length === 0}
                    style={styles.actionButton}
                >
                    开始同步
                </Button>
            </Surface>

            <Surface style={styles.sectionSurface} elevation={1}>
                <View style={styles.updateHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        更新
                    </Text>
                    <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                        APK-only 更新，启动后自动检查一次，支持 GitHub / 镜像源切换。
                    </Text>
                </View>

                <View style={styles.factRow}>
                    <Text variant="bodyMedium" style={styles.factLabel}>
                        当前版本
                    </Text>
                    <Text variant="bodyMedium" style={styles.factValue}>
                        v{updateState.CurrentVersion} · Build {updateState.CurrentVersionCode}
                    </Text>
                </View>

                <View style={styles.factRow}>
                    <Text variant="bodyMedium" style={styles.factLabel}>
                        更新状态
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={[
                            styles.factValue,
                            updateState.Status === "error" || updateState.Status === "permission-required"
                                ? styles.errorText
                                : null,
                        ]}
                    >
                        {statusText}
                    </Text>
                </View>

                <View style={styles.factRow}>
                    <Text variant="bodyMedium" style={styles.factLabel}>
                        更新源
                    </Text>
                    <Text variant="bodyMedium" style={styles.factValue}>
                        {sourceLabel}
                    </Text>
                </View>

                <SegmentedButtons
                    value={updateState.Source}
                    onValueChange={(value) => {
                        void HandleUpdateSourceChange(value);
                    }}
                    buttons={[
                        {
                            value: "github",
                            label: "GitHub",
                            disabled: busy || isUpdateActionBusy,
                        },
                        {
                            value: "mirror",
                            label: "镜像",
                            disabled: busy || isUpdateActionBusy,
                        },
                    ]}
                    style={styles.segmentedButtons}
                />

                {updateState.IsDownloading ? (
                    <ProgressBar
                        progress={updateState.DownloadProgress !== null ? updateState.DownloadProgress / 100 : 0}
                        indeterminate={updateState.DownloadProgress === null}
                        style={styles.progressBar}
                    />
                ) : null}

                <View style={styles.actionRow}>
                    <Button
                        mode="contained-tonal"
                        icon="refresh"
                        onPress={() => {
                            void HandleCheckUpdates();
                        }}
                        loading={updateState.IsChecking}
                        disabled={busy || isUpdateActionBusy}
                        style={styles.actionButton}
                    >
                        检查更新
                    </Button>

                    {hasUpdateDetails && !updateState.IsDownloaded ? (
                        <Button
                            mode="contained"
                            icon="download"
                            onPress={() => {
                                void HandleDownloadUpdate();
                            }}
                            loading={updateState.IsDownloading}
                            disabled={busy || isUpdateActionBusy}
                            style={styles.actionButton}
                        >
                            {downloadButtonLabel}
                        </Button>
                    ) : null}

                    {updateState.IsDownloaded || updateState.IsPermissionRequired ? (
                        <Button
                            mode="contained"
                            icon="application-import"
                            onPress={() => {
                                void HandleInstallUpdate();
                            }}
                            loading={updateState.IsInstalling}
                            disabled={busy || isUpdateActionBusy}
                            style={styles.actionButton}
                        >
                            安装更新
                        </Button>
                    ) : null}
                </View>

                {updateState.IsDownloaded || updateState.IsPermissionRequired ? (
                    <Button
                        mode="text"
                        icon="shield-key-outline"
                        onPress={() => {
                            void HandleOpenInstallPermissions();
                        }}
                        disabled={busy || isUpdateActionBusy}
                        style={styles.permissionButton}
                    >
                        打开安装权限设置
                    </Button>
                ) : null}

                {hasUpdateDetails ? (
                    <Surface style={styles.updateDetailSurface} elevation={0}>
                        <Text variant="labelLarge" style={styles.detailLabel}>
                            最新版本
                        </Text>
                        <Text variant="bodyMedium" style={styles.detailValue}>
                            v{updateState.AvailableVersion} · Build {updateState.AvailableVersionCode}
                        </Text>
                        <Text variant="bodyMedium" style={styles.detailValue}>
                            发布时间：{updateState.PublishedAt !== null ? FormatDateTime(new Date(updateState.PublishedAt)) : "未知"}
                        </Text>
                        <Text variant="bodyMedium" style={styles.detailValue}>
                            强制更新：{updateState.Force ? "是" : "否"}
                        </Text>
                        {updateState.Notes !== null && updateState.Notes.trim().length > 0 ? (
                            <Text variant="bodyMedium" style={styles.notesText}>
                                {updateState.Notes}
                            </Text>
                        ) : null}
                    </Surface>
                ) : null}

                {updateState.ErrorMessage !== null ? (
                    <Text variant="bodyMedium" style={styles.errorText}>
                        {updateState.ErrorMessage}
                    </Text>
                ) : null}
            </Surface>

            <Surface style={styles.sectionSurface} elevation={1}>
                <List.Section>
                    <List.Subheader>功能</List.Subheader>
                    <List.Item
                        title="AI 配置"
                        description="配置 AI 分析方式和 API 参数"
                        left={(props) => <List.Icon {...props} icon="robot-outline" />}
                        right={(props) => <List.Icon {...props} icon="chevron-right" />}
                        onPress={() => router.push("/settings/ai")}
                    />
                </List.Section>
            </Surface>

            <Surface style={styles.sectionSurface} elevation={1}>
                <View style={styles.updateHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        遥测
                    </Text>
                    <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                        帮助了解用户规模和版本分布，不涉及任何使用记录和个人信息。
                    </Text>
                </View>

                <View style={styles.telemetryRow}>
                    <Text variant="bodyMedium" style={styles.factLabel}>
                        开启遥测
                    </Text>
                    <Switch value={telemetryEnabled} onValueChange={HandleTelemetryToggle} />
                </View>

                {telemetryEnabled && (
                    <Text variant="bodySmall" style={styles.telemetryHint}>
                        上报数据：操作系统（{osLabel}）、应用版本（{appVersion}）
                    </Text>
                )}

                <List.Item
                    title="上报日志"
                    description="仅排查问题时需要"
                    left={(props) => <List.Icon {...props} icon="text-box-search-outline" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => setTelemetryDebugVisible(true)}
                    style={styles.telemetryDebugEntry}
                />
            </Surface>

            <Surface style={styles.aboutSurface} elevation={0}>
                <Text variant="labelLarge" style={styles.aboutLabel}>
                    关于
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    DickHelper Android MVP
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    版本：v{updateState.CurrentVersion} · Build {updateState.CurrentVersionCode}
                </Text>
                <Text variant="bodyMedium" style={styles.aboutText}>
                    平台：Android
                </Text>
                <Text variant="bodySmall" style={styles.aboutHint}>
                    当前记录数：{records.length}，最近一条：{records[0] !== undefined ? FormatDateTime(records[0].EndTime) : "暂无"}
                </Text>
            </Surface>

            <Portal>
                <Dialog visible={syncDialogVisible} onDismiss={() => setSyncDialogVisible(false)}>
                    <Dialog.Title style={{ color: syncDialogSuccess ? theme.colors.success : theme.colors.error }}>
                        {syncDialogSuccess ? "同步成功" : "同步失败"}
                    </Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">{syncDialogContent}</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setSyncDialogVisible(false)}>确定</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={telemetryConfirmVisible} onDismiss={() => setTelemetryConfirmVisible(false)}>
                    <Dialog.Title>确认关闭遥测？</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">
                            关闭后将不再上报任何数据。我们仅收集以下信息：操作系统、应用版本。不涉及任何使用记录和个人信息。
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setTelemetryConfirmVisible(false)}>取消</Button>
                        <Button textColor={theme.colors.error} onPress={HandleConfirmTelemetryDisable}>确认关闭</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={telemetryDebugVisible} onDismiss={() => setTelemetryDebugVisible(false)}>
                    <Dialog.Title>遥测上报日志</Dialog.Title>
                    <Dialog.Content>
                        <View style={styles.telemetryDebugContent}>
                            <View style={styles.telemetryDebugBlock}>
                                <Text variant="labelMedium" style={styles.telemetryDebugLabel}>
                                    当前 UUID
                                </Text>
                                <Text variant="bodyMedium" style={styles.telemetryDebugValue}>
                                    {debugInfo.uuid ?? "未生成"}
                                </Text>
                            </View>

                            <View style={styles.telemetryDebugBlock}>
                                <Text variant="labelMedium" style={styles.telemetryDebugLabel}>
                                    上次尝试时间
                                </Text>
                                <Text variant="bodyMedium" style={styles.telemetryDebugValue}>
                                    {FormatTelemetryDebugTime(debugInfo.lastAttemptAt)}
                                </Text>
                            </View>

                            <View style={styles.telemetryDebugBlock}>
                                <Text variant="labelMedium" style={styles.telemetryDebugLabel}>
                                    上次成功时间
                                </Text>
                                <Text variant="bodyMedium" style={styles.telemetryDebugValue}>
                                    {FormatTelemetryDebugTime(debugInfo.lastSuccessAt)}
                                </Text>
                            </View>

                            <View style={styles.telemetryDebugBlock}>
                                <Text variant="labelMedium" style={styles.telemetryDebugLabel}>
                                    最近错误
                                </Text>
                                <Text variant="bodyMedium" style={styles.telemetryDebugValue}>
                                    {debugInfo.lastErrorText ?? "无"}
                                </Text>
                            </View>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setTelemetryDebugVisible(false)}>关闭</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3200}>
                {message}
            </Snackbar>
        </ScrollView>
    );
}

function FormatTelemetryDebugTime(value: string | null): string {
    if (value === null) {
        return "无";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return FormatDateTime(parsed);
}

function GetUpdateStatusText(status: MobileUpdateStatus): string {
    switch (status) {
        case "idle":
            return "等待检查";
        case "checking":
            return "正在检查更新";
        case "up-to-date":
            return "已是最新版本";
        case "available":
            return "发现新版本";
        case "downloading":
            return "正在下载 APK";
        case "downloaded":
            return "APK 已下载完成";
        case "installing":
            return "正在打开系统安装器";
        case "permission-required":
            return "需要先允许安装未知应用";
        case "error":
            return "发生错误";
        case "disabled":
            return "当前平台不支持";
    }
}

function BuildUpdateResultMessage(state: IMobileUpdateState): string {
    switch (state.Status) {
        case "up-to-date":
            return "当前已是最新版本";
        case "available":
            return state.AvailableVersion !== null ? `发现新版本 v${state.AvailableVersion}` : "发现新版本";
        case "downloading":
            return "正在下载更新包";
        case "downloaded":
            return "更新包已下载完成，可直接安装";
        case "installing":
            return "系统安装器已打开";
        case "permission-required":
            return "需要先允许安装未知应用";
        case "error":
            return state.ErrorMessage ?? "更新操作失败";
        case "disabled":
            return "当前平台不支持 APK 更新";
        case "checking":
            return "正在检查更新";
        case "idle":
            return "更新状态已刷新";
    }
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
        sectionSurface: {
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            padding: 16,
            gap: 16,
        },
        sectionTitle: {
            color: theme.colors.onSurface,
            fontWeight: "700",
        },
        sectionSubtitle: {
            color: theme.colors.onSurfaceVariant,
            lineHeight: 20,
        },
        updateHeader: {
            gap: 8,
        },
        factRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
        },
        factLabel: {
            color: theme.colors.textMuted,
            flexShrink: 0,
        },
        factValue: {
            color: theme.colors.onSurface,
            flex: 1,
            textAlign: "right",
        },
        errorText: {
            color: theme.colors.error,
        },
        segmentedButtons: {
            marginTop: 4,
        },
        progressBar: {
            marginTop: 4,
        },
        actionRow: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
        },
        actionButton: {
            borderRadius: 12,
        },
        permissionButton: {
            alignSelf: "flex-start",
            marginLeft: -8,
        },
        updateDetailSurface: {
            borderRadius: 10,
            backgroundColor: theme.colors.background,
            padding: 12,
            gap: 6,
        },
        detailLabel: {
            color: theme.colors.textMuted,
        },
        detailValue: {
            color: theme.colors.onSurface,
        },
        notesText: {
            color: theme.colors.textBody,
            lineHeight: 22,
            marginTop: 4,
        },
        aboutSurface: {
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            padding: 16,
            gap: 6,
        },
        aboutLabel: {
            color: theme.colors.textMuted,
        },
        aboutText: {
            color: theme.colors.onSurface,
        },
        aboutHint: {
            color: theme.colors.textMuted,
            marginTop: 4,
        },
        textInput: {
            backgroundColor: theme.colors.surface,
        },
        telemetryRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        telemetryHint: {
            color: theme.colors.textMuted,
            marginTop: 4,
        },
        telemetryDebugEntry: {
            paddingHorizontal: 0,
        },
        telemetryDebugContent: {
            gap: 12,
        },
        telemetryDebugBlock: {
            gap: 4,
        },
        telemetryDebugLabel: {
            color: theme.colors.textMuted,
        },
        telemetryDebugValue: {
            color: theme.colors.onSurface,
        },
    });
}
