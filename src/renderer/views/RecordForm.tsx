import { useState } from "react";
import {
    Paper,
    Stack,
    Title,
    Button,
    Textarea,
    Group,
    Text,
    Badge,
    rem,
} from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop, IconPlayerPause } from "@tabler/icons-react";
import { useTimer } from "../hooks/useTimer";
import { DatabaseService } from "../services/DatabaseService";
import { useRecords } from "../hooks/useRecords";

const FormatTime = (seconds: number): string => {
    const minutes: number = Math.floor(seconds / 60);
    const remainingSeconds: number = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
};

export const RecordForm = () => {
    const { IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop } = useTimer();
    const { refresh } = useRecords();
    const [notes, setNotes] = useState<string>("");

    const statusLabel: string = !IsRecording ? "未开始" : IsPaused ? "已暂停" : "记录中";
    const statusColor: string = !IsRecording ? "gray" : IsPaused ? "yellow" : "green";

    const HandleStartStop = (): void => {
        if (!IsRecording) {
            Start();
            return;
        }
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

    return (
        <Stack gap="lg" maw={720} mx="auto">
            <Stack gap={4}>
                <Title order={3} c="blue">记录</Title>
                <Text size="sm" c="dimmed">
                    开始计时，结束后自动保存本次记录。
                </Text>
            </Stack>

            <Paper shadow="sm" radius="md" p="xl" withBorder>
                <Stack gap="lg" align="center">
                    <Badge variant="light" color={statusColor} size="lg">
                        {statusLabel}
                    </Badge>

                    <Stack gap={4} align="center">
                        <Text size="sm" c="dimmed">
                            本次用时
                        </Text>
                        <Text
                            size="48px"
                            fw={700}
                            c="blue"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                            {IsRecording ? FormatTime(ElapsedSeconds) : "准备开始"}
                        </Text>
                    </Stack>

                    <Group justify="center">
                        <Button
                            size="lg"
                            color={IsRecording ? "red" : "blue"}
                            variant={IsRecording ? "light" : "filled"}
                            miw={120}
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
                                color={IsPaused ? "green" : "yellow"}
                                variant="light"
                                miw={120}
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

                    <Textarea
                        label="备注（可选）"
                        placeholder="记录一些想法..."
                        description="备注会和本次记录一起保存。"
                        minRows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.currentTarget.value)}
                        style={{ width: "100%", maxWidth: 520 }}
                    />
                </Stack>
            </Paper>
        </Stack>
    );
};
