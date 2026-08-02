import { useEffect, useRef, useState } from "react";
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

// 与移动端 Snackbar 的 duration 对齐，两端提示存活时间一致
const MESSAGE_DURATION_MS: number = 3000;

// 不换行空格，写成转义是因为源码里的裸 U+00A0 看不出来
const NBSP: string = "\u00A0";

const FormatTime = (seconds: number): string => {
    const minutes: number = Math.floor(seconds / 60);
    const remainingSeconds: number = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
};

export const RecordForm = () => {
    const { IsRecording, IsPaused, ElapsedSeconds, Start, Pause, Resume, Stop, Cancel } = useTimer();
    const { refresh } = useRecords();
    const [notes, setNotes] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const statusLabel: string = !IsRecording ? "未开始" : IsPaused ? "已暂停" : "记录中";
    const statusColor: string = !IsRecording ? "gray" : IsPaused ? "yellow" : "green";

    const ClearMessageTimeout = (): void => {
        if (messageTimeoutRef.current !== null) {
            clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = null;
        }
    };

    // 每次设提示都先清掉上一条的定时器，否则前一条的 timeout 会把刚设的这条提前抹掉
    const ShowMessage = (text: string): void => {
        ClearMessageTimeout();
        setMessage(text);
        messageTimeoutRef.current = setTimeout(() => {
            setMessage("");
            messageTimeoutRef.current = null;
        }, MESSAGE_DURATION_MS);
    };

    const HandleStartStop = (): void => {
        if (!IsRecording) {
            // 重新开始前连提示带它的定时器一起清掉
            ClearMessageTimeout();
            setMessage("");
            Start();
            return;
        }
        const result = Stop();
        if (result !== null) {
            DatabaseService.SaveRecord(
                result.StartTime,
                result.EndTime,
                result.DurationMinutes,
                notes || undefined
            )
                .then(() => {
                    setNotes("");
                    ShowMessage("记录已保存");
                    refresh();
                })
                // 计时已经结束、状态已清空，存库失败必须说出来，否则这次记录就无声无息地丢了
                .catch((error: unknown) => {
                    const reason: string = error instanceof Error ? error.message : String(error);
                    ShowMessage(`保存失败：${reason}`);
                });
        }
    };

    const HandleCancel = (): void => {
        Cancel();
        setNotes("");
        ShowMessage("已取消，本次未保存");
    };

    const HandlePauseResume = (): void => {
        if (IsPaused) {
            Resume();
        } else {
            Pause();
        }
    };

    // 卸载时清掉待触发的 timeout。依赖数组必须为空、清理内联：填了依赖就会每次重渲染都跑一遍 cleanup，把刚设的提示定时器清掉
    useEffect(() => {
        return () => {
            if (messageTimeoutRef.current !== null) {
                clearTimeout(messageTimeoutRef.current);
            }
        };
    }, []);

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
                            {IsRecording ? "结束并保存" : "开始"}
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

                    {IsRecording && (
                        // 没有二次确认框，与主操作区拉开的这段距离是防误触的唯一防线，别改小。
                        // 距离刻意全压在按钮自己的 mt 上（xl = 32px），不依赖外层 Stack 的 gap —— 否则将来调小 gap 会静默缩水这道防线
                        <Button variant="subtle" size="sm" color="gray" mt="xl" onClick={HandleCancel}>
                            取消本次计时
                        </Button>
                    )}

                    {/* 这行始终渲染：它是内联文字而非浮层，出现或消失都会顶动下方备注框，加上 3 秒自动消失就会让界面跳两次。
                        无消息时用不换行空格占住一行（普通空格会被折叠、撑不出高度），高度由字体自身算出，不写死像素 */}
                    <Text size="sm" c="dimmed" ta="center">
                        {message === "" ? NBSP : message}
                    </Text>

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
