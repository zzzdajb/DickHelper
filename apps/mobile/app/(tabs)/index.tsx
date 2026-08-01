import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Surface, Text, TextInput, useTheme, Snackbar } from "react-native-paper";
import { useMobileDatabaseService } from "../../src/hooks/useMobileDatabaseService";
import { useTimer } from "../../src/hooks/useTimer";
import { FormatElapsedSeconds } from "../../src/utils/formatters";

export default function RecordScreen() {
    const theme = useTheme();
    const database = useMobileDatabaseService();
    const timer = useTimer();
    const [notes, setNotes] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);
    const [message, setMessage] = useState<string | null>(null);

    const statusLabel = useMemo((): string => {
        if (!timer.isRecording) {
            return "未开始";
        }

        if (timer.isPaused) {
            return "已暂停";
        }

        return "记录中";
    }, [timer.isPaused, timer.isRecording]);

    const HandleStart = (): void => {
        if (timer.isRecording) {
            return;
        }

        setMessage(null);
        timer.start();
    };

    const HandlePauseResume = (): void => {
        if (timer.isPaused) {
            timer.resume();
            return;
        }

        timer.pause();
    };

    const HandleCancel = (): void => {
        timer.cancel();
        setNotes("");
        setMessage("已取消，本次未保存");
    };

    const HandleStop = async (): Promise<void> => {
        const result = timer.stop();
        if (result === null) {
            return;
        }

        setSaving(true);
        try {
            const trimmedNotes = notes.trim();
            await database.SaveRecord(
                result.startTime,
                result.endTime,
                result.durationMinutes,
                trimmedNotes.length > 0 ? trimmedNotes : undefined
            );
            setNotes("");
            setMessage("记录已保存");
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
                    记录
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                    轻点开始，完成后自动记录到本地
                </Text>
            </View>

            <Surface style={[styles.timerSurface, { borderColor: theme.colors.outline }]} elevation={1}>
                <Text variant="labelLarge" style={styles.statusText}>
                    {statusLabel}
                </Text>
                <Text variant="displayMedium" style={styles.timerText}>
                    {FormatElapsedSeconds(timer.elapsedSeconds)}
                </Text>
                <Text variant="bodySmall" style={styles.captionText}>
                    本次记录时长
                </Text>
            </Surface>

            <View style={styles.actions}>
                {!timer.isRecording ? (
                    <Button
                        mode="contained"
                        icon="play"
                        onPress={HandleStart}
                        contentStyle={styles.primaryButtonContent}
                        style={styles.actionButton}
                    >
                        开始
                    </Button>
                ) : (
                    <>
                        <Button
                            mode="outlined"
                            icon={timer.isPaused ? "play" : "pause"}
                            onPress={HandlePauseResume}
                            contentStyle={styles.actionButtonContent}
                            style={styles.actionButton}
                        >
                            {timer.isPaused ? "继续" : "暂停"}
                        </Button>
                        <Button
                            mode="contained"
                            buttonColor={theme.colors.error}
                            icon="stop"
                            loading={saving}
                            disabled={saving}
                            onPress={() => {
                                void HandleStop();
                            }}
                            contentStyle={styles.actionButtonContent}
                            style={styles.actionButton}
                        >
                            结束并保存
                        </Button>
                        <Button
                            mode="text"
                            disabled={saving}
                            onPress={HandleCancel}
                            style={styles.cancelButton}
                        >
                            取消本次计时
                        </Button>
                    </>
                )}
            </View>

            <TextInput
                mode="outlined"
                label="备注"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={5}
                placeholder="补充一些简短备注"
                style={styles.notesInput}
            />

            <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
                {message}
            </Snackbar>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        padding: 16,
        gap: 20,
    },
    header: {
        gap: 8,
    },
    title: {
        color: "#0f766e",
        fontWeight: "700",
    },
    subtitle: {
        color: "#475569",
    },
    timerSurface: {
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        width: 280,
        height: 280,
        borderRadius: 140,
        borderWidth: 1,
        backgroundColor: "#ffffff",
        padding: 24,
    },
    statusText: {
        color: "#475569",
        marginBottom: 8,
    },
    timerText: {
        color: "#0f766e",
        fontWeight: "700",
        textAlign: "center",
    },
    captionText: {
        color: "#64748b",
        marginTop: 8,
    },
    actions: {
        gap: 12,
    },
    actionButton: {
        borderRadius: 12,
    },
    actionButtonContent: {
        height: 52,
    },
    primaryButtonContent: {
        height: 56,
    },
    // 没有二次确认框，与主操作区拉开的这段距离是防误触的唯一防线
    cancelButton: {
        marginTop: 24,
    },
    notesInput: {
        backgroundColor: "#ffffff",
    },
});
