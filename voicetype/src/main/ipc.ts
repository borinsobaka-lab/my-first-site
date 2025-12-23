import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AppSettings, RecordingState } from '../../shared/types';
import settingsManager from './settings';
import { insertText } from './textInput';
import { updateHotkey } from './shortcuts';

let mainWindowRef: BrowserWindow | null = null;

export function setupIPC(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

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

    // For auto-paste mode, we need to blur/hide VoiceType window first
    // so that focus returns to the previous window
    if (insertMode === 'type' && mainWindowRef) {
      // Hide the window temporarily to return focus to previous app
      const wasVisible = mainWindowRef.isVisible();
      if (wasVisible) {
        mainWindowRef.hide();
        // Wait for OS to switch focus back to previous window
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      await insertText(data.text, insertMode);

      // Show window again after paste (optional - user might not want this)
      // For now, keep it hidden - user can access via tray
      // if (wasVisible) {
      //   mainWindowRef.show();
      // }
    } else {
      await insertText(data.text, insertMode);
    }

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
