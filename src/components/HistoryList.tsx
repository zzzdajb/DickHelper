import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack
} from '@mui/material';
import { StorageService } from '../services/storage';
import { MasturbationRecord } from '../types/record';
import DeleteIcon from '@mui/icons-material/Delete';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";

/**
 * 历史记录列表组件
 * 展示所有自慰记录的历史列表，包含以下功能：
 * 1. 显示记录的详细信息（时间、持续时间、备注）
 * 2. 删除单条记录
 * 3. 清空所有记录（带确认对话框）
 * 4. 自动更新数据（定时更新和事件监听）
 */
export const HistoryList = () => {

    /**
     * 导出数据为JSON文件
     */
    const handleExport = () => {
        const data = StorageService.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'masturbation_records.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * 从JSON文件导入数据
     */
    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                const success = StorageService.importData(content);
                if (!success) {
                    alert('导入失败：数据格式不正确');
                }
            }
        };
        reader.readAsText(file);
    };
    // 所有记录数据
    const [records, setRecords] = useState<MasturbationRecord[]>([]);
    // 清空确认对话框的显示状态
    const [openDialog, setOpenDialog] = useState(false);

    /**
     * 更新记录数据
     * 从StorageService获取最新数据并更新状态
     */
    const updateData = () => {
        const newRecords = StorageService.getRecords();
        setRecords(newRecords);
    };

    // 组件挂载时设置自动更新
    useEffect(() => {
        // 初始加载数据
        updateData();
        // 每分钟自动更新一次
        const interval = setInterval(updateData, 60000);

        // 监听记录更新事件
        const handleRecordUpdate = () => {
            updateData();
        };
        window.addEventListener('masturbation_record_updated', handleRecordUpdate);

        // 清理定时器和事件监听
        return () => {
            clearInterval(interval);
            window.removeEventListener('masturbation_record_updated', handleRecordUpdate);
        };
    }, []);

    // 监听localStorage变化
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'masturbation_records') {
                updateData();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    /**
     * 删除单条记录
     * @param id 要删除的记录ID
     */
    const handleDeleteRecord = (id: string) => {
        StorageService.deleteRecord(id);
        setRecords(records.filter(record => record.id !== id));
    };

    /**
     * 清空所有记录
     */
    const handleClearAllRecords = () => {
        records.forEach(record => StorageService.deleteRecord(record.id));
        setRecords([]);
        setOpenDialog(false);
    };

    return (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3
            }}>

                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 700,
                        background: 'linear-gradient(45deg, #2196f3 30%, #64b5f6 90%)',
                        backgroundClip: 'text',
                        textFillColor: 'transparent',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}
                >
                    历史记录
                </Typography>
                <IconButton
                    color="error"
                    onClick={() => setOpenDialog(true)}
                    title="清空所有数据"
                    sx={{
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        '&:hover': {
                            backgroundColor: 'rgba(244, 67, 54, 0.2)'
                        }
                    }}
                >
                    <CleaningServicesIcon />
                </IconButton>
            </Box>

            <Box sx={{
                display: 'flex',
                justifyContent: 'end',
                alignItems: 'center',
                mb: 3
            }}>
                <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                      variant="outlined"
                      startIcon={<FileDownloadIcon />}
                      onClick={handleExport}
                    >
                        导出数据
                    </Button>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<FileUploadIcon />}
                    >
                        导入数据
                        <input
                          type="file"
                          hidden
                          accept=".json"
                          onChange={handleImport}
                        />
                    </Button>
                </Stack>
            </Box>

            <Box sx={{
                width: '100%',
                maxWidth: '800px',
                mb: 4,
                mx: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
            }}>
                {records.slice().reverse().map(record => {
                    const minutes = Math.floor(record.duration);
                    const seconds = Math.round((record.duration - minutes) * 60);
                    return (
                        <Paper
                            key={record.id}
                            elevation={1}
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                p: 2.5,
                                boxSizing: 'border-box',
                                borderRadius: 3,
                                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                                transition: 'all 0.3s ease',
                                width: '100%',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                                }
                            }}
                        >
                                <Box sx={{ flex: 1 }}>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            mb: 1,
                                            color: 'primary.main',
                                            fontWeight: 600
                                        }}
                                    >
                                        {new Date(record.startTime).toLocaleString()}
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            color: 'text.secondary',
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: 2
                                        }}
                                    >
                                        <Box component="span" sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                            borderRadius: 1,
                                            px: 1.5,
                                            py: 0.5
                                        }}>
                                            持续时间：{minutes}分{seconds}秒
                                        </Box>
                                        {record.notes && (
                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: 'text.secondary',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                    borderRadius: 1,
                                                    px: 1.5,
                                                    py: 0.5,
                                                    wordBreak: 'break-all'
                                                }}
                                            >
                                                备注：{record.notes}
                                            </Typography>
                                        )}
                                    </Typography>
                                </Box>
                                <IconButton
                                    onClick={() => handleDeleteRecord(record.id)}
                                    color="error"
                                    size="medium"
                                    sx={{
                                        ml: 2,
                                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                        '&:hover': {
                                            backgroundColor: 'rgba(244, 67, 54, 0.2)',
                                            transform: 'scale(1.1)'
                                        },
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Paper>
                        );
                    })}

                    <Dialog
                        open={openDialog}
                        onClose={() => setOpenDialog(false)}
                    >
                        <DialogTitle>确认清空数据</DialogTitle>
                        <DialogContent>
                            <Typography>确定要删除所有记录吗？此操作不可恢复。</Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOpenDialog(false)}>取消</Button>
                            <Button onClick={handleClearAllRecords} color="error">
                                确认清空
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Box>
        </Box>
    );
};
