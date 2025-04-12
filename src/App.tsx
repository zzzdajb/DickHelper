import { useState } from 'react';
import './App.css';
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Box,
  Tabs,
  Tab,
  Paper, AppBar, IconButton,
} from '@mui/material';
import { RecordForm } from './components/RecordForm';
import { StatsChart } from './components/StatsChart';
import { HistoryList } from './components/HistoryList';
import { UpdateDialog } from './components/UpdateDialog';
import { StarOnGithub } from "./components/StarOnGithub.tsx";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{pt: 3}}>
          {children}
        </Box>
      )}
    </div>
  );
}

const theme = createTheme({
  typography: {
    fontFamily: [
      '思源黑体',
      'Noto Sans SC',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"'
    ].join(','),
  },
  palette: {
    primary: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Paper sx={{minHeight: '100vh', backgroundColor: 'background.default'}}>
        <UpdateDialog/>
        <Paper sx={{
          position:'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: 'background.paper',
          borderRadius: 0
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            pl: 2
          }}>
            <IconButton sx={{position: 'absolute', left: 4}}>✈️</IconButton>
            <Tabs value={tabValue}
                  onChange={handleTabChange}
                  aria-label="basic tabs example">
              <Tab label="主页面" id="simple-tab-0" aria-controls="simple-tabpanel-0"/>
              <Tab label="历史记录" id="simple-tab-1" aria-controls="simple-tabpanel-1"/>
            </Tabs>
          </Box>
        </Paper>

        <Box sx={{p: 2, pt: 0}}>
          <TabPanel value={tabValue} index={0}>
            <StarOnGithub/>
            <RecordForm/>
            <StatsChart/>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <HistoryList/>
          </TabPanel>
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default App;
