import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, RecordingState, IPC_CHANNELS } from '../../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI = {
  // Settings
  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET);
  },

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings);
  },

  // Text insertion
  insertText: (text: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TEXT_INSERT, { text });
  },

  // Transcription events
  sendTranscriptionResult: (text: string): void => {
    ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_RESULT, { text });
  },

  sendTranscriptionError: (error: string): void => {
    ipcRenderer.send(IPC_CHANNELS.TRANSCRIPTION_ERROR, { error });
  },

  // Tray updates
  updateTrayState: (state: RecordingState): void => {
    ipcRenderer.send(IPC_CHANNELS.TRAY_UPDATE_STATE, state);
  },

  // Event listeners
  onRecordingStart: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on(IPC_CHANNELS.RECORDING_START, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_START, subscription);
    };
  },

  onRecordingStop: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on(IPC_CHANNELS.RECORDING_STOP, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_STOP, subscription);
    };
  },

  onStateChanged: (callback: (state: RecordingState) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, state: RecordingState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.STATE_CHANGED, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_CHANGED, subscription);
    };
  },

  onShowAbout: (callback: () => void): (() => void) => {
    const subscription = () => callback();
    ipcRenderer.on('show-about', subscription);
    return () => {
      ipcRenderer.removeListener('show-about', subscription);
    };
  },

  // Platform info
  platform: process.platform,
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript type declaration for the exposed API
export type ElectronAPI = typeof electronAPI;

// Declare the global type
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
