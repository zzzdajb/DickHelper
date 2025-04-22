import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

interface UpdateInfo {
    version: string;
    date: string;
    changes: string[];
}

const VERSION_HISTORY: UpdateInfo[] = [
    {
        version: 'v0.2.0',
        date: '2025-04-22',
        changes: [
            '支持刷新页面恢复计时',
            '新增最长持续时间、本年次数统计',
            '优化贡献图展示样式，展示近一年的统计数据',
        ]
    },
    {
        version: 'v0.1.1',
        date: '2025-02-20',
        changes: [
            '新增更新公告弹窗，方便用户了解最新变化',
            '调整了一些文字内容，防止尴尬',
            '修复了一些已知问题'
        ]
    },
    {
        version: 'v0.1.0',
        date: '2025-02-20',
        changes: [
            '正式发布',
            '基础记录功能',
            '统计图表功能',
            '历史记录管理'
        ]
    }
];


const LOCAL_STORAGE_KEY = 'next_update_notice_date';

export const UpdateDialog = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const nextNoticeDate = localStorage.getItem(LOCAL_STORAGE_KEY);
        const now = new Date();

        if (!nextNoticeDate || new Date(nextNoticeDate) <= now) {
            setOpen(true);
        }
    }, []);

    const handleClose = (dontShowFor3Days: boolean = false) => {
        setOpen(false);
        // 只有当用户选择"3天内不再提示
        if (dontShowFor3Days) {
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 3);
            localStorage.setItem(LOCAL_STORAGE_KEY, nextDate.toISOString());
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            aria-labelledby="update-dialog-title"
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle id="update-dialog-title" sx={{
                background: 'linear-gradient(45deg, #2196f3 30%, #64b5f6 90%)',
                color: 'white',
                fontWeight: 700
            }}>
                更新公告
            </DialogTitle>
            <DialogContent sx={{ mt: 2, maxHeight: 400, overflowY: 'auto' }}>
                {VERSION_HISTORY.map((version, versionIndex) => (
                    <Box key={version.version} sx={{ mb: versionIndex < VERSION_HISTORY.length - 1 ? 4 : 2 }}>
                        <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            color: versionIndex === 0 ? 'primary.main' : 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                            {version.version}
                            {versionIndex === 0 && (
                                <Typography
                                    component="span"
                                    variant="caption"
                                    sx={{
                                        backgroundColor: 'primary.main',
                                        color: 'white',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1,
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    最新
                                </Typography>
                            )}
                        </Typography>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                            发布日期：{version.date}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
                            更新内容：
                        </Typography>
                        <Box component="ul" sx={{ mt: 0, pl: 2 }}>
                            {version.changes.map((change, index) => (
                                <Typography
                                    key={index}
                                    component="li"
                                    variant="body1"
                                    sx={{ mb: 1, color: 'text.secondary' }}
                                >
                                    {change}
                                </Typography>
                            ))}
                        </Box>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
                <Button
                    onClick={() => handleClose(true)}
                    variant="outlined"
                    sx={{
                        borderRadius: 2,
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '&:hover': {
                            borderColor: 'primary.dark',
                            backgroundColor: 'rgba(33, 150, 243, 0.08)'
                        }
                    }}
                >
                    3天内不再提示
                </Button>
                <Button
                    onClick={() => handleClose()}
                    variant="contained"
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        background: 'linear-gradient(45deg, #2196f3 30%, #64b5f6 90%)',
                        '&:hover': {
                            background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)'
                        }
                    }}
                >
                    我知道了
                </Button>
            </DialogActions>
        </Dialog>
    );
};