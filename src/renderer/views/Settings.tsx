import { Paper, Title, Text, Stack } from "@mantine/core";

/**
 * 设置页面（MVP 占位）
 * 后续迭代中可添加深色模式切换、数据路径配置等功能
 */
export const Settings = () => {
    return (
        <Paper shadow="sm" radius="md" p="lg" withBorder>
            <Stack gap="md" align="center">
                <Title order={3} c="blue">
                    设置
                </Title>
                <Text c="dimmed">更多设置功能即将推出...</Text>
            </Stack>
        </Paper>
    );
};
