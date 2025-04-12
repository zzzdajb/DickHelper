import { useState, useEffect } from 'react';
import { Button, TextField, Box, Typography, Stack, Paper, Fade, IconButton } from '@mui/material';
import { StorageService } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TimerIcon from '@mui/icons-material/Timer';

/**
 * 记录表单组件
 * 用于记录新的自慰数据，包含以下功能：
 * 1. 计时器功能：开始/停止计时
 * 2. 添加备注信息
 * 3. 数据导入导出功能
 */
export const RecordForm = () => {
  // 记录状态：是否正在记录中
  const [isRecording, setIsRecording] = useState(false);
  // 是否暂停中
  const [isPaused, setIsPaused] = useState(false);
  // 开始时间
  const [startTime, setStartTime] = useState<Date | null>(null);
  // 已经过的时间（秒）
  const [elapsedTime, setElapsedTime] = useState(0);
  // 暂停时累计的时间（毫秒）
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  // 上次暂停的时间
  const [lastPauseTime, setLastPauseTime] = useState<Date | null>(null);
  // 备注信息
  const [notes, setNotes] = useState('');

  // 计时器效果：每秒更新已经过的时间
  useEffect(() => {
    let intervalId: number;
    if (isRecording && startTime && !isPaused) {
      intervalId = window.setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime() - accumulatedTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    // 清理定时器
    return () => clearInterval(intervalId);
  }, [isRecording, startTime, isPaused, accumulatedTime]);

  /**
   * 处理开始/停止按钮点击
   * 开始：设置开始时间，启动计时器
   * 停止：保存记录，重置状态
   */
  const handleStartStop = () => {
    if (!isRecording) {
      // 开始记录
      setStartTime(new Date());
      setIsRecording(true);
      setIsPaused(false);
      setAccumulatedTime(0);
      setLastPauseTime(null);
    } else {
      // 停止记录
      setIsRecording(false);
      setIsPaused(false);
      if (startTime) {
        const endTime = new Date();
        const totalPausedTime = accumulatedTime + (lastPauseTime ? endTime.getTime() - lastPauseTime.getTime() : 0);
        const durationInMinutes = (endTime.getTime() - startTime.getTime() - totalPausedTime) / (1000 * 60);

        // 创建记录对象
        const record = {
          id: uuidv4(),
          startTime: endTime,
          duration: Number(durationInMinutes.toFixed(2)),
          notes: notes || undefined
        };

        // 保存记录并重置状态
        StorageService.saveRecord(record);
        setStartTime(null);
        setElapsedTime(0);
        setAccumulatedTime(0);
        setLastPauseTime(null);
        setNotes('');

        // 触发自定义事件通知数据更新
        const event = new CustomEvent('masturbation_record_updated');
        window.dispatchEvent(event);
      }
    }
  };

  /**
   * 处理暂停/继续按钮点击
   */
  const handlePause = () => {
    if (!isRecording) return;

    if (!isPaused) {
      // 暂停计时
      setIsPaused(true);
      setLastPauseTime(new Date());
    } else {
      // 继续计时
      setIsPaused(false);
      if (lastPauseTime) {
        const now = new Date();
        setAccumulatedTime(prev => prev + (now.getTime() - lastPauseTime.getTime()));
        setLastPauseTime(null);
      }
    }
  };

  /**
   * 格式化时间显示
   * @param seconds 秒数
   * @returns 格式化后的时间字符串（分:秒）
   */
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <Paper elevation={3} sx={{
      p: 2,
      borderRadius: 1,
      width: '100%',
      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
      }
    }}>
      <Stack spacing={3}>
        <Typography variant="h5" sx={{fontWeight: 700}}>记录新的手艺活</Typography>

        <Typography variant="body1" color="text.secondary" sx={{mt: '10px!important', fontWeight: 500}}>
          {isRecording ? formatTime(elapsedTime) : '准备开始'}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleStartStop}
            startIcon={isRecording ? <StopIcon/> : <PlayArrowIcon/>}
            color={isRecording ? 'error' : 'primary'}
            sx={{px: 4, py: 1.5}}>
            {isRecording ? '结束' : '开始记录'}
          </Button>
          {isRecording && (
            <Button
              variant="contained"
              size="large"
              onClick={handlePause}
              startIcon={isPaused ? <PlayArrowIcon/> : <TimerIcon/>}
              color="warning"
              sx={{ flex: 'none', borderRadius: 28, px: 4, py: 1.5}}>
              {isPaused ? '继续' : '暂停'}
            </Button>
          )}
        </Stack>

        <TextField
          fullWidth
          size="small"
          label="备注（可选）"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}/>
      </Stack>
    </Paper>
  );
};
