import { Box, Button, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";

export const StarOnGithub = () => {
  return (
  <Box sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    mb: 4
  }}>
    <Typography
      variant="subtitle2"
      sx={{
        color: 'text.secondary',
        fontWeight: 500,
        fontSize: '0.875rem'
      }}
    >
      祝愿所有给本项目Star的小伙伴牛子长度翻倍！
    </Typography>
    <Button
      variant="contained"
      color="primary"
      startIcon={<GitHubIcon/>}
      onClick={() => window.open('https://github.com/zzzdajb/DickHelper', '_blank')}
      sx={{
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 600,
        background: 'linear-gradient(45deg, #24292e 30%, #40464e 90%)',
        '&:hover': {
          background: 'linear-gradient(45deg, #40464e 30%, #586069 90%)',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        },
        transition: 'all 0.3s ease'
      }}
    >
      ⭐ Star on GitHub
    </Button>
  </Box>
)
}
