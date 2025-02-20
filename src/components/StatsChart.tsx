import { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import { StorageService } from '../services/storage';
import { MasturbationRecord, MasturbationStats } from '../types/record';

const DAYS_IN_WEEK = 7;
const WEEKS_TO_SHOW = 4; // 将显示时间范围改为4周
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * 统计图表组件
 * 展示自慰记录的统计数据和可视化图表，包含以下功能：
 * 1. 显示基础统计数据（总次数、平均时长、周频率、月频率）
 * 2. 展示类似GitHub贡献图的自慰日历
 * 3. 自动更新数据（定时更新和事件监听）
 */
export const StatsChart = () => {
    // 统计数据状态
    const [stats, setStats] = useState<MasturbationStats>({
        totalCount: 0,
        averageDuration: 0,
        frequencyPerWeek: 0,
        frequencyPerMonth: 0
    });
    // 记录数据状态
    const [records, setRecords] = useState<MasturbationRecord[]>([]);

    /**
     * 更新统计数据和记录
     * 从StorageService获取最新数据并更新状态
     */
    const updateData = () => {
        const newStats = StorageService.getStats();
        const newRecords = StorageService.getRecords();
        setStats(newStats);
        setRecords(newRecords);
    };

    // 组件挂载时设置自动更新
    useEffect(() => {
        updateData();
        const interval = setInterval(updateData, 60000);

        // 监听记录更新事件
        const handleRecordUpdate = () => {
            updateData();
        };
        window.addEventListener('masturbation_record_updated', handleRecordUpdate);

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
     * 获取贡献度等级（0-4）
     * @param count 当天的记录次数
     * @returns 贡献度等级
     */
    const getContributionLevel = (count: number): number => {
        if (count === 0) return 0;
        if (count === 1) return 1;
        if (count === 2) return 2;
        if (count === 3) return 3;
        return 4;
    };

    /**
     * 生成贡献图数据
     * @returns 二维数组，表示每周每天的记录次数
     */
    const generateContributionData = () => {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW));

        // 初始化贡献数据数组
        const contributionData = Array(WEEKS_TO_SHOW).fill(0).map(() =>
            Array(DAYS_IN_WEEK).fill(0)
        );

        // 统计每天的记录次数
        records.forEach(record => {
            const recordDate = new Date(record.startTime);
            if (recordDate >= startDate) {
                const daysSince = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
                const weekIndex = WEEKS_TO_SHOW - 1 - Math.floor(daysSince / 7);
                let dayIndex = recordDate.getDay();
                if (dayIndex === 0) dayIndex = 6; // 将周日从0改为6
                else dayIndex -= 1; // 其他日期减1，使周一为0
                if (weekIndex >= 0 && weekIndex < WEEKS_TO_SHOW) {
                    contributionData[weekIndex][dayIndex]++;
                }
            }
        });

        return contributionData;
    };

    /**
     * 获取月份标签
     * @returns 月份标签数组，包含标签文本和对应的周索引
     */
    const getMonthLabels = () => {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (DAYS_IN_WEEK * WEEKS_TO_SHOW));
        const months: { label: string; index: number }[] = [];
        
        // 生成月份标签
        for (let week = 0; week < WEEKS_TO_SHOW; week++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + (week * 7));
            const monthName = date.getMonth() + 1;
            if (week === 0 || date.getDate() <= 7) {
                months.push({ label: `${monthName}月`, index: week });
            }
        }
        return months;
    };

    // 生成贡献图数据和月份标签
    const contributionData = generateContributionData();
    const monthLabels = getMonthLabels();

    return (
        <Box sx={{ 
            mt: 4,
            width: '100%',
            maxWidth: '600px',
            mx: 'auto'
        }}>
            <Typography 
                variant="h5" 
                sx={{
                    fontWeight: 700,
                    mb: 3,
                    background: 'linear-gradient(45deg, #2196f3 30%, #64b5f6 90%)',
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}
            >
                统计数据
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }} columns={12}>
                <Grid item xs={12} sm={6}>
                    <Paper 
                        sx={{ 
                            p: 2,
                            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                            borderRadius: 3,
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        <Typography 
                            variant="subtitle1" 
                            color="text.secondary"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            总次数
                        </Typography>
                        <Typography 
                            variant="h3"
                            sx={{ 
                                fontWeight: 700,
                                color: 'primary.main'
                            }}
                        >
                            {stats.totalCount}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Paper 
                        sx={{ 
                            p: 3,
                            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                            borderRadius: 3,
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        <Typography 
                            variant="subtitle1" 
                            color="text.secondary"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            平均持续时间
                        </Typography>
                        <Typography 
                            variant="h3"
                            sx={{ 
                                fontWeight: 700,
                                color: 'primary.main'
                            }}
                        >
                            {stats.averageDuration.toFixed(1)}
                            <Typography 
                                component="span" 
                                variant="h5" 
                                sx={{ 
                                    ml: 1,
                                    color: 'text.secondary',
                                    fontWeight: 500
                                }}
                            >
                                分钟
                            </Typography>
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Paper 
                        sx={{ 
                            p: 3,
                            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                            borderRadius: 3,
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        <Typography 
                            variant="subtitle1" 
                            color="text.secondary"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            本周次数
                        </Typography>
                        <Typography 
                            variant="h3"
                            sx={{ 
                                fontWeight: 700,
                                color: 'primary.main'
                            }}
                        >
                            {stats.frequencyPerWeek}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Paper 
                        sx={{ 
                            p: 3,
                            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                            borderRadius: 3,
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        <Typography 
                            variant="subtitle1" 
                            color="text.secondary"
                            sx={{ mb: 1, fontWeight: 500 }}
                        >
                            本月次数
                        </Typography>
                        <Typography 
                            variant="h3"
                            sx={{ 
                                fontWeight: 700,
                                color: 'primary.main'
                            }}
                        >
                            {stats.frequencyPerMonth}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Paper elevation={2} sx={{
                p: 3,
                borderRadius: 3,
                width: '100%',
                maxWidth: '100%',
                minHeight: '300px',
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                mb: 4,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                }
            }}>
                <Typography 
                    variant="h6" 
                    sx={{
                        mb: 3,
                        fontWeight: 600,
                        color: 'text.primary'
                    }}
                >
                    自慰日历
                </Typography>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    width: 'fit-content',
                    minWidth: 'auto',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: 2,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    pb: 2
                }}>
                    {/* 月份标签 */}
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        pt: 4
                    }}>
                        {monthLabels.map((month, index) => (
                            <Typography
                                key={index}
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    fontSize: '10px',
                                    height: '12px',
                                    lineHeight: '12px',
                                    mb: month.index === 0 ? 0 : '2px'
                                }}
                            >
                                {month.label}
                            </Typography>
                        ))}
                    </Box>

                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* 星期标签 */}
                        <Box sx={{
                            display: 'flex',
                            mb: 1,
                            gap: '2px'
                        }}>
                            {WEEKDAYS.map((day, index) => (
                                <Typography
                                    key={index}
                                    variant="caption"
                                    sx={{
                                        width: '10px',
                                        textAlign: 'center',
                                        color: 'text.secondary',
                                        fontSize: '9px'
                                    }}
                                >
                                    {day}
                                </Typography>
                            ))}
                        </Box>

                        {/* 贡献图 */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateRows: `repeat(${WEEKS_TO_SHOW}, 1fr)`,
                            gap: '4px',
                            flex: 1
                        }}>
                            {contributionData.map((week, weekIndex) => (
                                <Box key={weekIndex} sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                    gap: '4px'
                                }}>
                                    {week.map((count, dayIndex) => {
                                        const date = new Date();
                                        date.setDate(date.getDate() - ((WEEKS_TO_SHOW - weekIndex - 1) * 7 + dayIndex));
                                        return (
                                            <Box
                                                key={`${weekIndex}-${dayIndex}`}
                                                sx={{
                                                    width: '16px',
                                                    height: '16px',
                                                    backgroundColor: count === 0 ? 'rgba(235, 237, 240, 0.5)' : `rgba(40, 167, 69, ${getContributionLevel(count) * 0.25})`,
                                                    border: '1px solid rgba(27, 31, 35, 0.06)',
                                                    borderRadius: '2px',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        transform: 'scale(1.1)',
                                                        boxShadow: '0 0 4px rgba(0,0,0,0.1)'
                                                    }
                                                }}
                                                title={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日: ${count}次`}
                                            />
                                        );
                                    })}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};