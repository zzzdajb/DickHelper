import { useState } from "react";
import {
    Paper,
    Stack,
    Title,
    Button,
    Textarea,
    Group,
    Text,
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
        <Paper shadow="sm" radius="md" p="xl" withBorder>
            <Stack gap="lg" align="center">
                <Title order={3} c="blue">
                    记录新的手艺活
                </Title>

                <Text
                    size="48px"
                    fw={700}
                    variant="gradient"
                    gradient={{ from: "blue", to: "cyan", deg: 135 }}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
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

                <Textarea
                    label="备注（可选）"
                    placeholder="记录一些想法..."
                    minRows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.currentTarget.value)}
                    style={{ width: "100%", maxWidth: 400 }}
                />
            </Stack>
        </Paper>
    );
};
