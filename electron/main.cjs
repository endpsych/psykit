const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');

const DEV_SERVER_URL = process.env.PSYKIT_DEV_SERVER_URL;
const DIST_ENTRY = path.join(__dirname, '..', 'dist', 'index.html');

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 760,
    minHeight: 720,
    backgroundColor: '#0f172a',
    title: 'PsychKit',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
    const isRelaunchCombo =
      input.type === 'keyDown'
      && key === 'r'
      && (input.control || input.meta);
    const isRefreshKey = input.type === 'keyDown' && input.key === 'F5';

    if (!isRelaunchCombo && !isRefreshKey) {
      return;
    }

    event.preventDefault();

    if (isRelaunchCombo) {
      app.relaunch();
      app.exit(0);
      return;
    }

    win.webContents.reloadIgnoringCache();
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    return win;
  }

  win.loadFile(DIST_ENTRY);
  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
