/// <reference types="vite/client" />

import { AppSettings, RecordingState, RecordingMode, LogEntry } from '../../shared/types';

// Electron API exposed through preload script
interface ElectronAPI {
  // Settings
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

  // Text insertion
  insertText: (text: string) => Promise<{ success: boolean }>;

  // Transcription events
  sendTranscriptionResult: (text: string) => void;
  sendTranscriptionError: (error: string) => void;

  // Sync recording state to main process
  syncRecordingState: (isRecording: boolean) => void;

  // Tray updates
  updateTrayState: (state: RecordingState, mode?: RecordingMode) => void;

  // Event listeners
  onRecordingStart: (callback: (mode: RecordingMode) => void) => () => void;
  onRecordingStop: (callback: () => void) => () => void;
  onStateChanged: (callback: (state: RecordingState) => void) => () => void;
  onShowAbout: (callback: () => void) => () => void;

  // Logs
  getLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<{ success: boolean }>;
  onLogMessage: (callback: (entry: LogEntry) => void) => () => void;

  // Platform info
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
