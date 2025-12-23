import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { setupIPC } from './ipc';
import { registerHotkey, unregisterAllShortcuts } from './shortcuts';
import { createTray, destroyTray, updateTrayState } from './tray';
import { IPC_CHANNELS, RecordingState } from '../../shared/types';
import settingsManager from './settings';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: true,
    show: false, // Start hidden, show when ready
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for preload script
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Hide window instead of closing (minimize to tray)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Setup IPC handlers
  setupIPC(mainWindow);

  // Register global hotkey
  registerHotkey(mainWindow);

  // Create system tray
  createTray(mainWindow);

  // Handle tray state updates from renderer
  ipcMain.on(IPC_CHANNELS.TRAY_UPDATE_STATE, (_event, state: RecordingState) => {
    updateTrayState(state);
  });
}

// Configure auto-launch
function setupAutoLaunch(): void {
  const autoStart = settingsManager.get('autoStart');

  app.setLoginItemSettings({
    openAtLogin: autoStart,
    openAsHidden: true,
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  setupAutoLaunch();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('will-quit', () => {
  // Cleanup
  unregisterAllShortcuts();
  destroyTray();
});

// Handle certificate errors in development
if (isDev) {
  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window when trying to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
