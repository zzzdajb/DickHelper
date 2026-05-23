import { useState, useRef } from "react";
import {
    Paper,
    Stack,
    Title,
    Button,
    Textarea,
    Group,
    Text,
    Notification,
    rem,
} from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop, IconPlayerPause, IconDownload, IconUpload } from "@tabler/icons-react";
import { useTimer } from "../hooks/useTimer";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";

/**
 * 计时记录组件
 * 开始/暂停/继续/停止计时器，保存记录时写入 SQLite
 * 支持 JSON 导入导出，兼容旧版格式
 */
export const RecordForm = () => {
    const { IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop } = useTimer();
    const { refresh } = useRecords();
    const [notes, setNotes] = useState<string>("");
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const importMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 格式化秒数为 "X分X秒"
    const FormatTime = (seconds: number): string => {
        const minutes: number = Math.floor(seconds / 60);
        const remainingSeconds: number = seconds % 60;
        return `${minutes}分${remainingSeconds}秒`;
    };

    const HandleStartStop = (): void => {
        if (!IsRecording) {
            Start();
            return;
        }
        // 停止并保存
        const result = Stop();
        if (result !== null) {
            DatabaseService.SaveRecord(
                result.startTime,
                result.endTime,
                result.durationMinutes,
                notes || undefined
            ).then(() => {
                setNotes("");
                refresh();
            });
        }
    };

    const HandlePauseResume = (): void => {
        if (IsPaused) {
            Resume();
        } else {
            Pause();
        }
    };

    const HandleExport = async (): Promise<void> => {
        const records = await DatabaseService.GetRecords();
        const jsonText: string = DatabaseService.ExportToJson(records);
        const blob = new Blob([jsonText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "masturbation_records.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const HandleImport = async (file: File | null): Promise<void> => {
        if (file === null) return;
        try {
            const text = await file.text();
            const result = await DatabaseService.ImportFromJson(text);
            // 显示导入结果
            const msg: string = `导入完成：成功 ${result.Imported} 条，跳过 ${result.Skipped} 条重复，拒绝 ${result.Rejected} 条无效数据`;
            ShowImportMessage(msg);
            refresh();
        } catch {
            ShowImportMessage("导入失败：数据格式不正确");
        }
    };

    const ShowImportMessage = (msg: string): void => {
        setImportMessage(msg);
        if (importMessageTimerRef.current !== null) {
            clearTimeout(importMessageTimerRef.current);
        }
        importMessageTimerRef.current = setTimeout(() => {
            setImportMessage(null);
        }, 5000);
    };

    // 跳过 Mantine FileInput 的文件验证，直接读取文本
    const HandleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (file !== null && file !== undefined) {
            HandleImport(file);
        }
        // 重置 input 以允许重复选择同一文件
        e.target.value = "";
    };

    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Stack gap="md">
                <Title order={3} ta="center" c="blue">
                    记录新的手艺活
                </Title>

                <Stack gap="md" align="center">
                    <Text size="xl" fw={700}>
                        {IsRecording ? FormatTime(ElapsedSeconds) : "准备开始"}
                    </Text>

                    <Group>
                        <Button
                            size="lg"
                            radius="xl"
                            color={IsRecording ? "red" : "blue"}
                            leftSection={
                                IsRecording ? (
                                    <IconPlayerStop style={{ width: rem(20), height: rem(20) }} />
                                ) : (
                                    <IconPlayerPlay style={{ width: rem(20), height: rem(20) }} />
                                )
                            }
                            onClick={HandleStartStop}
                        >
                            {IsRecording ? "结束" : "开始"}
                        </Button>
                        {IsRecording && (
                            <Button
                                size="lg"
                                radius="xl"
                                color={IsPaused ? "green" : "yellow"}
                                leftSection={
                                    IsPaused ? (
                                        <IconPlayerPlay style={{ width: rem(20), height: rem(20) }} />
                                    ) : (
                                        <IconPlayerPause style={{ width: rem(20), height: rem(20) }} />
                                    )
                                }
                                onClick={HandlePauseResume}
                            >
                                {IsPaused ? "继续" : "暂停"}
                            </Button>
                        )}
                    </Group>
                </Stack>

                <Textarea
                    label="备注（可选）"
                    placeholder="记录一些想法..."
                    minRows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.currentTarget.value)}
                />

                <Group justify="center">
                    <Button
                        variant="outline"
                        leftSection={<IconDownload style={{ width: rem(16), height: rem(16) }} />}
                        onClick={HandleExport}
                    >
                        导出数据
                    </Button>
                    <Button
                        variant="outline"
                        leftSection={<IconUpload style={{ width: rem(16), height: rem(16) }} />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        导入数据
                    </Button>
                    {/* 隐藏的原生文件输入，通过 ref 触发 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={HandleFileChange}
                        style={{ display: "none" }}
                    />
                </Group>

                {importMessage !== null && (
                    <Notification
                        color="blue"
                        title="导入结果"
                        onClose={() => setImportMessage(null)}
                        withCloseButton
                    >
                        {importMessage}
                    </Notification>
                )}
            </Stack>
        </Paper>
    );
};
