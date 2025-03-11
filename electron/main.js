import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保在打包环境中设置正确的NODE_ENV
if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 800,
    height: 1400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // 加载应用
  // 在开发环境中，我们总是使用localhost:5173
  // 在生产环境中，我们使用打包后的文件
  if (!app.isPackaged) {
    // 开发环境：加载本地开发服务器
    mainWindow.loadURL('http://localhost:5173/');
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的静态文件
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    mainWindow.loadFile(indexPath);
  }

  // 当 window 被关闭，这个事件会被触发
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(createWindow);

// 当全部窗口关闭时退出
app.on('window-all-closed', function () {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (mainWindow === null) createWindow();
});

// 在这个文件中，你可以续写应用剩下主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。