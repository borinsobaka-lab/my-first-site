import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AppSettings, RecordingState } from '../../shared/types';
import settingsManager from './settings';
import { insertText } from './textInput';
import { updateHotkey } from './shortcuts';
import { getLogs, clearLogs, logInfo, logError, logSuccess, setLoggerWindow } from './logger';

let mainWindowRef: BrowserWindow | null = null;

export function setupIPC(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
  setLoggerWindow(mainWindow);

  // Handle settings get request
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return settingsManager.getAll();
  });

  // Handle settings set request
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, settings: Partial<AppSettings>) => {
    const oldHotkey = settingsManager.get('hotkey');
    settingsManager.setMultiple(settings);

    // Re-register hotkey if it was changed
    if (settings.hotkey && settings.hotkey !== oldHotkey) {
      console.log('Hotkey changed, re-registering:', settings.hotkey);
      updateHotkey();
    }

    return settingsManager.getAll();
  });

  // Handle text insertion
  ipcMain.handle(IPC_CHANNELS.TEXT_INSERT, async (_event, data: { text: string }) => {
    const insertMode = settingsManager.get('insertMode');
    const textLength = data.text?.length || 0;

    logInfo(`Вставка текста: ${textLength} символов`, `Режим: ${insertMode === 'type' ? 'автовставка' : 'буфер обмена'}`);

    // For auto-paste mode, hide VoiceType window to not interfere
    if (insertMode === 'type' && mainWindowRef) {
      const wasVisible = mainWindowRef.isVisible();
      if (wasVisible) {
        mainWindowRef.hide();
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    try {
      await insertText(data.text, insertMode);
      if (insertMode === 'type') {
        logSuccess('Текст вставлен успешно', `Текст: "${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`);
      } else {
        logSuccess('Текст скопирован в буфер обмена');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('Ошибка вставки текста', errorMessage);
      throw error;
    }

    return { success: true };
  });

  // Handle transcription result
  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_RESULT, (_event, data: { text: string }) => {
    logInfo('Транскрибация получена', `Текст: "${data.text.substring(0, 100)}${data.text.length > 100 ? '...' : ''}"`);
  });

  // Handle transcription error
  ipcMain.on(IPC_CHANNELS.TRANSCRIPTION_ERROR, (_event, data: { error: string }) => {
    logError('Ошибка транскрибации', data.error);
  });

  // Handle logs get request
  ipcMain.handle(IPC_CHANNELS.LOGS_GET, () => {
    return getLogs();
  });

  // Handle logs clear request
  ipcMain.handle(IPC_CHANNELS.LOGS_CLEAR, () => {
    clearLogs();
    return { success: true };
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
