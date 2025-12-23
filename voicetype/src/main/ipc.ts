import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AppSettings, RecordingState } from '../../shared/types';
import settingsManager from './settings';
import { insertText } from './textInput';

export function setupIPC(mainWindow: BrowserWindow): void {
  // Handle settings get request
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return settingsManager.getAll();
  });

  // Handle settings set request
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Partial<AppSettings>) => {
    settingsManager.setMultiple(settings);
    return settingsManager.getAll();
  });

  // Handle text insertion
  ipcMain.handle(IPC_CHANNELS.TEXT_INSERT, async (_event, data: { text: string }) => {
    const insertMode = settingsManager.get('insertMode');
    await insertText(data.text, insertMode);
    return { success: true };
  });

  // Handle transcription result (for logging/analytics)
  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_RESULT, (_event, data: { text: string }) => {
    console.log('Transcription received:', data.text);
  });

  // Handle transcription error
  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_ERROR, (_event, data: { error: string }) => {
    console.error('Transcription error:', data.error);
  });
}

// Send recording start signal to renderer
export function sendRecordingStart(window: BrowserWindow): void {
  window.webContents.send(IPC_CHANNELS.RECORDING_START);
}

// Send recording stop signal to renderer
export function sendRecordingStop(window: BrowserWindow): void {
  window.webContents.send(IPC_CHANNELS.RECORDING_STOP);
}

// Send state change to renderer
export function sendStateChange(window: BrowserWindow, state: RecordingState): void {
  window.webContents.send(IPC_CHANNELS.STATE_CHANGED, state);
}
